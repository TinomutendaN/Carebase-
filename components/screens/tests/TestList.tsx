"use client";

import { useState } from "react";
import { Pill, PillGroup } from "@/components/ui/Pill";
import { cx } from "@/lib/cx";
import { TEST_CATEGORIES, type TestCategory, type TestResult } from "@/lib/test-runs";
import { CATEGORY_META } from "./categories";

type Tab = "all" | "failing" | TestCategory;

/** Rows on the All tab before "Show all N tests" (as in the design). */
const ALL_PREVIEW = 14;

/** "Test questions": filter tabs, one row per test, and a GOT box under each failure. */
export function TestList({ results }: { results: TestResult[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [expanded, setExpanded] = useState(false);

  const failing = results.filter((r) => !r.passed);
  const rows = tab === "all" ? results : tab === "failing" ? failing : results.filter((r) => r.category === tab);
  const shown = tab === "all" && !expanded ? rows.slice(0, ALL_PREVIEW) : rows;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "all", label: "All", count: results.length },
    { key: "failing", label: "Failing", count: failing.length },
    ...TEST_CATEGORIES.map((c) => ({ key: c, label: CATEGORY_META[c].tab })),
  ];

  return (
    <section
      aria-labelledby="list-title"
      className="flex flex-col gap-1.5 rounded-3xl border border-hairline/90 bg-linear-to-b from-surface to-surface-soft px-6 py-[22px] shadow-card max-sm:px-4"
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="list-title" className="m-0 text-[17px] font-bold">
          Test questions
        </h2>
        <PillGroup label="Filter tests">
          {tabs.map((t) => (
            <Pill
              key={t.key}
              pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              style={tab === t.key && t.key === "failing" ? { color: "#B42318" } : undefined}
            >
              {t.label}
              {t.count !== undefined && ` ${t.count}`}
            </Pill>
          ))}
        </PillGroup>
      </div>

      <div aria-hidden="true" className="flex flex-wrap gap-4 border-b border-divider px-1 py-2.5 text-[11px] font-bold tracking-[0.1em] text-label max-md:hidden">
        <span className="flex-[0_0_52px]">TEST</span>
        <span className="flex-[0_0_130px]">CATEGORY</span>
        <span className="flex-[1_1_260px]">QUESTION OR ACTION</span>
        <span className="flex-[1_1_240px]">EXPECTED BEHAVIOUR</span>
        <span className="flex-[0_0_72px] text-right">RESULT</span>
      </div>

      {shown.length === 0 && <p className="m-0 px-1 py-6 text-sm text-secondary">No tests are failing.</p>}
      <ul className="m-0 list-none p-0">
        {shown.map((r) => (
          <TestRow key={r.caseId} result={r} />
        ))}
      </ul>

      {tab === "all" && rows.length > ALL_PREVIEW ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 min-h-[46px] cursor-pointer rounded-xl border border-dashed border-primary-line bg-[#F7F9FF] text-[13px] font-bold text-primary-ink"
        >
          {expanded ? "Show fewer" : `Show all ${rows.length} tests`}
        </button>
      ) : (
        rows.length > 0 && (
          <p className="m-0 mt-2 flex min-h-[46px] items-center justify-center rounded-xl border border-dashed border-primary-line bg-[#F7F9FF] text-[13px] font-bold text-primary-ink">
            All {rows.length} shown
          </p>
        )
      )}
    </section>
  );
}

function TestRow({ result: r }: { result: TestResult }) {
  const meta = CATEGORY_META[r.category];
  return (
    <li className={cx("flex flex-col gap-2 border-b border-divider px-1 py-3.5", !r.passed && "bg-[#FFFBFB]")}>
      <div className="flex flex-wrap items-start gap-4 max-md:gap-x-3 max-md:gap-y-2">
        <span className="flex-[0_0_52px] pt-0.5 font-mono text-xs font-semibold text-secondary">{r.caseId}</span>
        <span className="flex-[0_0_130px]">
          <span className="inline-block rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: meta.bg, color: meta.fg }}>
            {meta.label}
          </span>
        </span>
        <span className="min-w-0 flex-[1_1_260px] text-sm leading-[1.45] font-semibold">{r.question}</span>
        <span className="min-w-0 flex-[1_1_240px] text-[13px] leading-[1.45] text-nav-text">{r.expected}</span>
        <span className="flex flex-[0_0_72px] justify-end max-md:order-first max-md:ml-auto">
          <span
            className={cx(
              "inline-flex items-center gap-[5px] rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.06em]",
              r.passed ? "bg-[#E3F6EC] text-[#15803D]" : "bg-[#FDECEC] text-[#B42318]",
            )}
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {r.passed ? "PASS" : "FAIL"}
          </span>
        </span>
      </div>
      {!r.passed && (
        <div className="ml-[68px] flex gap-2 rounded-xl border border-[#F8C9C7] bg-[#FFF4F4] px-3 py-2.5 text-[13px] text-[#8F1D14] max-md:ml-0">
          <span className="pt-px font-mono text-[11px] font-bold">GOT</span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="break-words">{r.actual ?? "(nothing recorded)"}</span>
            {r.reason && <span className="text-xs text-[#B42318]">Failed check: {r.reason}</span>}
          </div>
        </div>
      )}
    </li>
  );
}
