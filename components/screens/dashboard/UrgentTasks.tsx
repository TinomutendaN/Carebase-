import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { IconChip } from "@/components/ui/IconChip";
import { CalendarIcon, MoreIcon, TasksIcon } from "@/components/ui/icons";
import { Panel } from "@/components/ui/Panel";
import { StatusTag } from "@/components/ui/StatusTag";
import { cx } from "@/lib/cx";

export type UrgentTask = {
  id: number;
  title: string;
  detail: string | null;
  tag: "overdue" | "today" | "tomorrow" | "upcoming";
  /** "Was due 26 Nov", "Due today", "Due tomorrow", "Due 2 Dec" */
  dueLabel: string;
  patientId: string;
  patientName: string;
  patientInitials: string;
  /** Only for roles that see everyone's tasks. */
  assigneeName: string | null;
};

/** Avatar and "Open Record" colours follow the status tag, as in the design. */
const ACCENT = {
  overdue: { text: "text-[#FDA4AF]", avatar: "#FDA4AF" },
  today: { text: "text-amber-soft", avatar: "#FCD34D" },
  tomorrow: { text: "text-[#93C5FD]", avatar: "#93C5FD" },
  upcoming: { text: "text-[#93C5FD]", avatar: "#93C5FD" },
} as const;

/** "Most urgent tasks": the indigo panel at the bottom of the Dashboard. */
export function UrgentTasks({ tasks, allTasks }: { tasks: UrgentTask[]; allTasks: boolean }) {
  return (
    <Panel tone="indigo" aria-labelledby="urgent-title" className="flex flex-col gap-5 max-sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconChip color="teal" size={40}>
            <TasksIcon strokeWidth={2} />
          </IconChip>
          <div className="flex flex-col gap-0.5">
            <h2 id="urgent-title" className="m-0 text-base font-bold">
              Most urgent tasks
            </h2>
            <span className="text-xs text-lavender">
              {allTasks ? "Across the whole clinic, most urgent first" : "Assigned to you, most urgent first"}
            </span>
          </div>
        </div>
        <Link
          href="/tasks"
          className="inline-flex min-h-[38px] items-center rounded-full bg-linear-145 from-primary to-[#2F55E0] px-[18px] text-[13px] font-semibold text-white no-underline shadow-[0_8px_20px_rgba(47,85,224,0.4)]"
        >
          View all
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-[18px] border border-dashed border-white/16 px-6 py-9 text-center">
          <span className="text-[15px] font-bold">Nothing open</span>
          <span className="text-[13px] text-lavender">New tasks appear here, most urgent first.</span>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
          {tasks.map((t) => (
            <article
              key={t.id}
              className="flex flex-col gap-3 rounded-[18px] border border-white/12 bg-linear-to-b from-white/7 to-white/2 p-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <div className="flex items-center justify-between">
                <StatusTag status={t.tag} tone="dark" />
                <MoreIcon size={16} className="text-[#9A99C4]" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="m-0 text-base leading-[1.35] font-semibold">{t.title}</h3>
                {t.detail && <span className="text-xs text-lavender">{t.detail}</span>}
                {t.assigneeName && <span className="text-xs text-lavender">Assigned to {t.assigneeName}</span>}
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/6 bg-white/5 px-3 py-2.5">
                <Avatar initials={t.patientInitials} size={30} gradient={ACCENT[t.tag].avatar} className="text-[#1A1A45]!" />
                <div className="flex min-w-0 flex-col">
                  <span className="text-[11px] text-lavender">Patient</span>
                  <span className="truncate text-[13px] font-semibold">{t.patientName}</span>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2">
                <Link
                  href={`/patients/${t.patientId}`}
                  className={cx("text-sm font-semibold no-underline hover:underline", ACCENT[t.tag].text)}
                >
                  Open Record
                </Link>
                <span className="flex items-center gap-1.5 text-xs text-lavender">
                  <CalendarIcon size={13} strokeWidth={2} />
                  {t.dueLabel}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
