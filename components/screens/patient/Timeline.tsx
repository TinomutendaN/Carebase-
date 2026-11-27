"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";
import type { TimelineEntry } from "@/lib/db/queries/patients";
import { capitalize, formatDatePadded } from "@/lib/format";
import { formatLabValue, labShortName, labStatus, statusSentence } from "@/lib/lab-display";

const PAGE = 10;

const TAGS = {
  visit: { label: "Visit", className: "bg-[#EAF0FF] text-[#2442A8]" },
  lab: { label: "Lab", className: "bg-[#FFF1D6] text-[#8A4B00]" },
  medication: { label: "Medication", className: "bg-[#F0EAFE] text-[#5B3BC4]" },
} as const;

type Row = { id: string; date: string; type: keyof typeof TAGS; title: string; detail: string | null; value?: string; valueClass?: string };

function toRow(e: TimelineEntry): Row {
  if (e.type === "lab") {
    const status = labStatus(e.value, e.low, e.high);
    return {
      id: e.id,
      date: e.date,
      type: "lab",
      title: labShortName(e.code, e.name),
      detail: statusSentence(e.code, e.value, e.low, e.high, e.unit),
      value: formatLabValue(e.value, e.unit),
      valueClass: status === "above" ? "text-[#B45309]" : status === "below" ? "text-[#B42318]" : "text-ink",
    };
  }
  if (e.type === "medication") {
    const detail = e.event === "stopped" ? "Stopped" : e.detail ? `${capitalize(e.detail)}, started` : "Started";
    return { id: e.id, date: e.date, type: "medication", title: e.title, detail };
  }
  return { id: e.id, date: e.date, type: "visit", title: e.title, detail: e.detail };
}

/**
 * Visits, labs and medications, newest first. The first 10 show; the rest
 * (already loaded with the page) appear 10 at a time.
 */
export function Timeline({ entries, labsHidden }: { entries: TimelineEntry[]; labsHidden: boolean }) {
  const [shown, setShown] = useState(PAGE);
  const rows = entries.map(toRow);
  const left = rows.length - shown;

  return (
    <section
      aria-labelledby="tl-title"
      className="flex flex-col gap-1 rounded-[22px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft px-[22px] py-5 shadow-card"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
        <h2 id="tl-title" className="m-0 text-[17px] font-bold">
          Timeline
        </h2>
        <span className="text-xs text-secondary">
          {labsHidden ? "Visits and medications · lab entries hidden for Front Desk" : "Visits, labs and medications, newest first"}
        </span>
      </div>

      {rows.length === 0 && <p className="m-0 border-t border-divider pt-3 text-sm text-secondary">Nothing recorded yet.</p>}

      <ol className="m-0 list-none p-0">
        {rows.slice(0, shown).map((r) => (
          <li key={r.id} id={r.id} className="flex flex-wrap items-center gap-3.5 border-t border-divider py-3">
            <time dateTime={r.date} className="flex-[0_0_96px] font-mono text-xs text-secondary">
              {formatDatePadded(r.date)}
            </time>
            <span className={cx("min-w-[86px] flex-none rounded-full px-2.5 py-1 text-center text-[11px] font-bold", TAGS[r.type].className)}>
              {TAGS[r.type].label}
            </span>
            <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
              <span className="text-sm font-semibold">{r.title}</span>
              {r.detail && <span className="text-xs text-secondary">{r.detail}</span>}
            </span>
            {r.value && <span className={cx("font-mono text-[13px] font-semibold", r.valueClass)}>{r.value}</span>}
          </li>
        ))}
      </ol>

      {left > 0 && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-2 cursor-pointer self-center rounded-xl border border-field-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-nav-text shadow-field hover:bg-surface-soft"
        >
          Show {Math.min(PAGE, left)} more · {left} left
        </button>
      )}
    </section>
  );
}
