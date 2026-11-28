"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BoltIcon, ChevronDownIcon } from "@/components/ui/icons";
import { Pill, PillGroup } from "@/components/ui/Pill";
import { addDays } from "@/lib/clinic-date";
import { cx } from "@/lib/cx";
import type { AuditCounts, AuditEvent, AuditKind } from "@/lib/db/queries/audit";
import { formatDayLongMonth, formatWeekdayDate } from "@/lib/format";

type Tab = "all" | AuditKind;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "view", label: "Views" },
  { key: "change", label: "Changes" },
  { key: "blocked", label: "Blocked" },
];

/** Tag colours from designs/source/06-admin.html. */
const KINDS: Record<AuditKind, { label: string; tag: string }> = {
  view: { label: "VIEW", tag: "bg-[#EAF0FF] text-primary-ink" },
  change: { label: "CHANGE", tag: "bg-[#E3F6EC] text-[#166534]" },
  blocked: { label: "BLOCKED", tag: "bg-[#FDECEC] text-[#B42318]" },
};

const ROLE_NAMES: Record<string, string> = {
  front_desk: "Front Desk",
  clinician: "Clinician",
  admin: "Admin",
  system: "System",
};

export type AuditPage = {
  day: string;
  today: string;
  events: AuditEvent[];
  nextBefore: number | null;
  counts: AuditCounts;
};

/**
 * The audit log (designs/06-admin.png): one clinic day at a time, newest first,
 * with filter tabs, earlier days, "Load more", and test-runner rows hidden unless
 * "Show test runs" is on. Each change fetches GET /api/audit.
 */
export function AuditLog({ initial }: { initial: AuditPage }) {
  const [page, setPage] = useState(initial);
  const [tab, setTab] = useState<Tab>("all");
  const [showTests, setShowTests] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(next: { day?: string; tab?: Tab; showTests?: boolean; more?: boolean }) {
    const day = next.day ?? page.day;
    const kind = next.tab ?? tab;
    const tests = next.showTests ?? showTests;
    const params = new URLSearchParams({ day, kind, tests: tests ? "1" : "0" });
    if (next.more && page.nextBefore) params.set("before", String(page.nextBefore));

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/audit?${params}`, { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "The audit log couldn't be loaded. Try again.");
      const loaded = body as AuditPage;
      setPage(next.more ? { ...loaded, events: [...page.events, ...loaded.events] } : loaded);
      setTab(kind);
      setShowTests(tests);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The audit log couldn't be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const isToday = page.day === page.today;
  const { counts } = page;

  return (
    <section
      aria-labelledby="audit-title"
      className="flex min-w-0 flex-[999_1_560px] flex-col gap-1.5 rounded-[22px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft px-[22px] py-5 shadow-card"
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-[3px]">
          <h2 id="audit-title" className="m-0 text-[17px] font-bold">Audit log</h2>
          <span className="text-[13px] text-secondary">Who viewed or changed which record, and when</span>
        </div>
        <PillGroup label="Filter events">
          {TABS.map((t) => (
            <Pill key={t.key} pressed={tab === t.key} count={counts[t.key]} disabled={loading} onClick={() => load({ tab: t.key })}>
              {t.label}
            </Pill>
          ))}
        </PillGroup>
      </div>

      <div
        aria-hidden="true"
        className="flex flex-wrap gap-3.5 border-b border-divider px-1 py-2.5 text-[11px] font-bold tracking-[0.1em] text-label"
      >
        <span className="flex-[0_0_84px]">TIME</span>
        <span className="flex-[0_1_190px]">USER</span>
        <span className="flex-[1_1_200px]">ACTION</span>
        <span className="flex-[0_1_180px]">RECORD</span>
      </div>

      {error && (
        <p role="alert" className="m-0 mt-2 rounded-xl bg-[#FDECEC] px-3.5 py-2.5 text-[13px] font-medium text-[#B42318]">
          {error}
        </p>
      )}

      <ul aria-busy={loading} className={cx("m-0 list-none p-0 transition-opacity", loading && "opacity-60")}>
        {page.events.length === 0 && (
          <li className="border-b border-divider px-1 py-6 text-center text-[13px] text-secondary">
            {counts.all === 0 ? "No events on this day." : "No events of this kind on this day."}
          </li>
        )}
        {page.events.map((e) => (
          <AuditRow key={e.id} event={e} />
        ))}
      </ul>

      {page.nextBefore && (
        <button
          type="button"
          disabled={loading}
          onClick={() => load({ more: true })}
          className="mt-2 min-h-11 cursor-pointer rounded-xl border border-dashed border-primary-line bg-[#F7F9FF] font-sans text-[13px] font-semibold text-primary-ink disabled:cursor-default"
        >
          Load more
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 text-xs text-label">
          <DayButton label="Previous day" disabled={loading} onClick={() => load({ day: addDays(page.day, -1) })} direction="back" />
          <span>
            {isToday ? `Showing today’s events · ${formatDayLongMonth(page.day)}` : `Showing events · ${formatWeekdayDate(page.day)}`}
          </span>
          <DayButton label="Next day" disabled={loading || isToday} onClick={() => load({ day: addDays(page.day, 1) })} direction="forward" />
          {!isToday && (
            <button
              type="button"
              disabled={loading}
              onClick={() => load({ day: page.today })}
              className="ml-1 cursor-pointer border-none bg-transparent p-0 font-sans text-xs font-semibold text-primary-ink"
            >
              Back to today
            </button>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-nav-text">
          <input
            type="checkbox"
            checked={showTests}
            disabled={loading}
            onChange={(e) => load({ showTests: e.target.checked })}
            className="m-0 size-4 cursor-pointer accent-badge-blue"
          />
          Show test runs <span className="text-label">({counts.testRows})</span>
        </label>
      </div>
    </section>
  );
}

function DayButton({ label, direction, disabled, onClick }: {
  label: string;
  direction: "back" | "forward";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 cursor-pointer items-center justify-center rounded-lg border border-field-border bg-surface text-nav-text disabled:cursor-default disabled:opacity-40"
    >
      <ChevronDownIcon className={direction === "back" ? "rotate-90" : "-rotate-90"} />
    </button>
  );
}

function AuditRow({ event: e }: { event: AuditEvent }) {
  const kind = KINDS[e.kind];
  const isSystem = e.role === "system";
  const name = isSystem ? "Automatic follow-ups" : (e.name ?? e.email);
  return (
    <li
      className={cx(
        "flex flex-wrap items-center gap-3.5 border-b border-divider px-1 py-3",
        e.kind === "blocked" && "bg-[#FFF8F8]",
      )}
    >
      <span className="flex flex-[0_0_84px] items-baseline gap-1 font-mono text-xs font-semibold text-nav-text">
        <time dateTime={e.occurredAt}>{e.time}</time>
        <span className="text-[10px] font-medium text-label">{e.zone}</span>
      </span>
      <div className="flex min-w-0 flex-[0_1_190px] items-center gap-2.5">
        {isSystem ? (
          <span aria-hidden="true" className="flex size-[30px] flex-none items-center justify-center rounded-[10px] bg-linear-145 from-teal to-teal-deep text-white">
            <BoltIcon size={14} />
          </span>
        ) : (
          <Avatar initials={e.initials ?? "?"} size={30} />
        )}
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold">
            <span className="truncate">{name}</span>
            {e.isTest && (
              <span className="rounded px-1 py-px font-mono text-[9px] font-semibold tracking-wide text-label ring-1 ring-field-border">
                TEST
              </span>
            )}
          </span>
          <span className="text-[11px] text-label">{ROLE_NAMES[e.role] ?? e.role}</span>
        </span>
      </div>
      <div className="flex min-w-0 flex-[1_1_200px] items-center gap-2">
        <span className={cx("flex-none rounded-md px-2 py-[3px] font-mono text-[10px] font-semibold", kind.tag)}>{kind.label}</span>
        <span className="text-[13px] text-[#1E293B]">{e.action}</span>
      </div>
      <span className="min-w-0 flex-[0_1_180px] text-[13px] font-semibold">
        {e.patientId ? (
          <Link href={`/patients/${e.patientId}`} className="text-primary-ink no-underline hover:underline">
            {e.recordLabel ?? "Patient"}
          </Link>
        ) : (
          <span className="text-[#4B5A86]">{e.recordLabel ?? "—"}</span>
        )}
      </span>
    </li>
  );
}
