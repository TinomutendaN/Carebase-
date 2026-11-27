import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Status tags from the designs. Light versions sit on white cards (Tasks, Tests,
 * Intake, Admin); dark versions sit on indigo/teal panels (Dashboard urgent tasks).
 */
const STATUSES = {
  overdue: { label: "OVERDUE", light: "bg-[#FDECEC] text-[#B42318]", dark: "bg-red-soft/16 text-[#FDA4AF]" },
  today: { label: "DUE TODAY", light: "bg-[#FFF1D6] text-[#8A4B00]", dark: "bg-amber/16 text-amber-soft" },
  tomorrow: { label: "DUE TOMORROW", light: "bg-[#EAF0FF] text-primary-ink", dark: "bg-[#60A5FA]/18 text-[#93C5FD]" },
  upcoming: { label: "UPCOMING", light: "bg-[#EAF0FF] text-primary-ink", dark: "bg-[#60A5FA]/18 text-[#93C5FD]" },
  pass: { label: "PASS", light: "bg-[#E3F6EC] text-[#15803D]", dark: "bg-green/16 text-[#86EFAC]" },
  fail: { label: "FAIL", light: "bg-[#FDECEC] text-[#B42318]", dark: "bg-red-soft/16 text-[#FDA4AF]" },
  flagged: { label: "Flagged", light: "bg-[#FFF1D6] text-[#8A4B00]", dark: "bg-amber/16 text-amber-soft" },
  ready: { label: "Ready", light: "bg-[#E3F6EC] text-[#166534]", dark: "bg-green/16 text-[#86EFAC]" },
  approved: { label: "Approved", light: "bg-[#E3F6EC] text-[#166534]", dark: "bg-green/16 text-[#86EFAC]" },
  view: { label: "VIEW", light: "bg-[#EAF0FF] text-primary-ink", dark: "bg-[#60A5FA]/18 text-[#93C5FD]" },
  change: { label: "CHANGE", light: "bg-[#E3F6EC] text-[#166534]", dark: "bg-green/16 text-[#86EFAC]" },
  blocked: { label: "BLOCKED", light: "bg-[#FDECEC] text-[#B42318]", dark: "bg-red-soft/16 text-[#FDA4AF]" },
} as const;

export type Status = keyof typeof STATUSES;
export const STATUS_KEYS = Object.keys(STATUSES) as Status[];

export function StatusTag({ status, tone = "light", dot = tone === "dark", className, children }: {
  status: Status;
  tone?: "light" | "dark";
  /** Small leading dot in the tag colour (on by default for dark). */
  dot?: boolean;
  className?: string;
  /** Overrides the default label. */
  children?: ReactNode;
}) {
  const s = STATUSES[status];
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-bold tracking-[0.04em] whitespace-nowrap",
        s[tone],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {children ?? s.label}
    </span>
  );
}

/** Task source label: "AUTO · LAB" for lab-created tasks, "STAFF" for people. */
export function SourceTag({ source, className }: { source: "lab" | "staff"; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-[7px] py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap",
        source === "lab" ? "bg-[#E3F7F3] text-[#0F766E]" : "bg-tab-track text-nav-text",
        className,
      )}
    >
      {source === "lab" ? "AUTO · LAB" : "STAFF"}
    </span>
  );
}
