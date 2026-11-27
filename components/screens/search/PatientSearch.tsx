"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SearchIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import type { RecentPatient } from "@/lib/db/queries/audit";
import type { PatientMatch, SearchResult } from "@/lib/db/queries/patients";
import { formatDate } from "@/lib/format";

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 150;

/**
 * The last search in this tab (text, match count, ms), so the patient page can show
 * "1 match · 84 ms" after opening a result. Kept in sessionStorage, never in the URL,
 * so patient names stay out of browser history and server logs.
 */
const STORAGE_KEY = "carebase:lastSearch";
type LastSearch = { q: string; total: number; ms: number };

const noopSubscribe = () => () => {};
function readLastSearch(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function saveLastSearch(value: LastSearch | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the pill just won't carry over.
  }
}
function parseLastSearch(raw: string | null): LastSearch | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v?.q === "string" && Number.isFinite(v.total) && Number.isFinite(v.ms) ? v : null;
  } catch {
    return null;
  }
}

type Results = SearchResult & { q: string };
type Option = { id: string; name: string; initials: string; mrn: string; birthDate: string; note?: string };

/**
 * Patient search for the top bar: recently viewed patients before typing, then
 * matches by name or MRN with the server's search time ("3 matches · 12 ms").
 */
export function PatientSearch({ recent }: { recent: RecentPatient[] }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflight = useRef<AbortController>(undefined);

  // What the user typed this visit; null until they type, so the last search shows instead.
  const [typed, setTyped] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const lastSearch = parseLastSearch(useSyncExternalStore(noopSubscribe, readLastSearch, () => null));
  const query = typed ?? lastSearch?.q ?? "";
  const trimmed = query.trim();
  const searching = trimmed.length >= MIN_LENGTH;

  // The pill: this visit's results, or the search that led here.
  const pill =
    results && results.q === trimmed
      ? { total: results.total, ms: results.ms }
      : typed === null && lastSearch
        ? { total: lastSearch.total, ms: lastSearch.ms }
        : null;

  const options: Option[] = searching
    ? results && results.q === trimmed
      ? results.patients
      : []
    : recent.map((r) => ({ ...r, note: r.viewedLabel }));

  // ⌘K / Ctrl+K focuses the field.
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => {
    clearTimeout(timer.current);
    inflight.current?.abort();
  }, []);

  function runSearch(text: string) {
    clearTimeout(timer.current);
    inflight.current?.abort();
    const q = text.trim();
    if (q.length < MIN_LENGTH) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      inflight.current = controller;
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as SearchResult;
        setResults({ ...data, q });
        setStatus("idle");
        saveLastSearch({ q, total: data.total, ms: data.ms });
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("error");
      }
    }, DEBOUNCE_MS);
  }

  function onChange(text: string) {
    setTyped(text);
    setActive(-1);
    setOpen(true);
    runSearch(text);
  }

  function onFocus() {
    setOpen(true);
    // Arriving from a search: fetch its matches again so the dropdown can list them.
    if (searching && !(results && results.q === trimmed) && status === "idle") runSearch(trimmed);
  }

  function choose(option: Option) {
    if (!searching) saveLastSearch(null);
    setOpen(false);
    router.push(`/patients/${option.id}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (options.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
      return;
    }
    if (event.key === "Enter") {
      const target = options[active] ?? (searching && options.length === 1 ? options[0] : undefined);
      if (target) {
        event.preventDefault();
        choose(target);
      }
    }
  }

  const showList = open && (searching || recent.length > 0);
  const optionId = (i: number) => `${listId}-option-${i}`;

  return (
    <div className="relative min-w-0 flex-[1_1_320px]">
      <label className="box-border flex h-[46px] items-center gap-2.5 rounded-[13px] border-[1.5px] border-[#9DB2F7] bg-surface pr-2 pl-3.5 text-label shadow-[0_0_0_4px_rgba(76,114,240,0.12),0_2px_8px_rgba(40,52,120,0.05)]">
        <SearchIcon size={16} strokeWidth={2} />
        <span className="sr-only">Search patients by name or MRN</span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search by name or MRN…"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 appearance-none border-none bg-transparent font-sans text-sm font-medium text-ink outline-none placeholder:font-normal placeholder:text-label focus-visible:shadow-none focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        {searching && pill && (
          <span
            aria-live="polite"
            className="inline-flex flex-none items-center gap-1.5 rounded-lg bg-[#E3F6EC] px-2.5 py-[5px] font-mono text-[11px] font-semibold whitespace-nowrap text-[#166534]"
          >
            <span className="size-1.5 rounded-full bg-green" />
            {pill.total} {pill.total === 1 ? "match" : "matches"} · {pill.ms} ms
          </span>
        )}
      </label>

      {showList && (
        <div className="absolute top-[calc(100%+8px)] right-0 left-0 z-30 overflow-hidden rounded-[18px] border border-hairline/90 bg-surface shadow-[0_1px_2px_rgba(40,52,120,0.05),0_18px_44px_rgba(40,52,120,0.16)]">
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1.5">
            <span className="text-[11px] font-bold tracking-[0.12em] text-label">
              {searching ? "MATCHES" : "RECENTLY VIEWED"}
            </span>
            {searching && results && results.q === trimmed && results.total > results.patients.length && (
              <span className="text-[11px] text-secondary">
                Showing {results.patients.length} of {results.total}. Keep typing to narrow.
              </span>
            )}
          </div>
          <ul id={listId} role="listbox" aria-label={searching ? "Matching patients" : "Recently viewed patients"} className="m-0 list-none p-1.5 pt-0">
            {options.map((o, i) => (
              <li
                key={o.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                onMouseEnter={() => setActive(i)}
                className={cx(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2",
                  i === active ? "bg-primary-soft" : "hover:bg-surface-muted",
                )}
              >
                <OptionRow option={o} />
              </li>
            ))}
          </ul>
          {searching && options.length === 0 && (
            <p className="m-0 px-4 pt-1 pb-4 text-[13px] text-secondary">
              {status === "error"
                ? "Search failed. Please try again."
                : status === "loading"
                  ? "Searching…"
                  : "No patients match. Try a last name or the MRN."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function OptionRow({ option }: { option: Option | PatientMatch }) {
  return (
    <>
      <Avatar initials={option.initials} size={34} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-ink">{option.name}</span>
        <span className="font-mono text-[11px] text-secondary">
          DOB {formatDate(option.birthDate)} · MRN {option.mrn}
        </span>
      </span>
      {"note" in option && option.note && <span className="flex-none text-[11px] text-label">{option.note}</span>}
    </>
  );
}
