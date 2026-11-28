import type { TaskSummary as Summary } from "@/lib/db/queries/tasks";

const CARDS = [
  { key: "open", label: "Open tasks", color: "#4C72F0", glow: "rgba(76,114,240,0.5)" },
  { key: "overdue", label: "Overdue", color: "#E5484D", glow: "rgba(229,72,77,0.45)" },
  { key: "dueToday", label: "Due today", color: "#F59E0B", glow: "rgba(245,158,11,0.45)" },
  { key: "doneThisWeek", label: "Done this week", color: "#22C55E", glow: "rgba(34,197,94,0.45)" },
] as const;

/** The four number cards at the top of Tasks (designs/05-tasks-*.png). */
export function TaskSummary({ summary }: { summary: Summary }) {
  return (
    <section aria-label="Task summary" className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className="flex items-center gap-3.5 rounded-[18px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft px-[18px] py-4 shadow-card"
        >
          <span aria-hidden="true" className="h-10 w-3 flex-none rounded-md" style={{ background: c.color, boxShadow: `0 0 14px ${c.glow}` }} />
          <div className="flex flex-col">
            <span className="text-[26px] leading-[1.1] font-extrabold">{summary[c.key]}</span>
            <span className="text-[13px] text-secondary">{c.label}</span>
          </div>
        </div>
      ))}
    </section>
  );
}
