"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { PersonIcon } from "@/components/ui/icons";
import { Pill, PillGroup } from "@/components/ui/Pill";
import { SourceTag, StatusTag } from "@/components/ui/StatusTag";
import { cx } from "@/lib/cx";
import type { DueStatus } from "@/lib/db/queries/tasks";

export type TaskListItem = {
  id: number;
  title: string;
  detail: string | null;
  source: "lab" | "staff";
  status: DueStatus;
  /** "26 Nov" or "Today" */
  dueLabel: string;
  patientId: string;
  patientName: string;
  patientInitials: string;
  assigneeName: string;
  canComplete: boolean;
};

type Tab = "all" | DueStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Due today" },
  { key: "upcoming", label: "Upcoming" },
];

const DUE_COLORS: Record<DueStatus, string> = {
  overdue: "text-[#B42318]",
  today: "text-[#8A4B00]",
  upcoming: "text-nav-text",
};

/**
 * The task list with filter tabs. Ticking a box marks the task done (PATCH /api/tasks),
 * then the page refreshes so the row leaves the list and the counts update.
 * With `pageSize`, only that many rows show until "Show N more" is pressed.
 */
export function TaskList({ title, tasks, showAssignee, pageSize }: {
  title: string;
  tasks: TaskListItem[];
  showAssignee: boolean;
  pageSize?: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const count = (key: Tab) => (key === "all" ? tasks.length : tasks.filter((t) => t.status === key).length);
  const filtered = tab === "all" ? tasks : tasks.filter((t) => t.status === tab);
  const rows = pageSize && !expanded ? filtered.slice(0, pageSize) : filtered;
  const hidden = filtered.length - rows.length;

  async function complete(task: TaskListItem) {
    setError(null);
    setCompleting((ids) => [...ids, task.id]);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "The task couldn't be marked done. Try again.");
      }
      router.refresh();
    } catch (e) {
      setCompleting((ids) => ids.filter((id) => id !== task.id));
      setError(e instanceof Error ? e.message : "The task couldn't be marked done. Try again.");
    }
  }

  return (
    <section
      aria-labelledby="task-list-title"
      className="flex min-w-0 flex-[999_1_560px] flex-col gap-1.5 rounded-[22px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft px-[22px] py-5 shadow-card"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="task-list-title" className="m-0 text-[17px] font-bold">{title}</h2>
        <PillGroup label="Filter tasks">
          {TABS.map((t) => (
            <Pill
              key={t.key}
              pressed={tab === t.key}
              count={count(t.key)}
              onClick={() => {
                setTab(t.key);
                setExpanded(false);
              }}
            >
              {t.label}
            </Pill>
          ))}
        </PillGroup>
      </div>

      {error && (
        <p role="alert" className="m-0 rounded-xl bg-[#FDECEC] px-3.5 py-2.5 text-[13px] font-medium text-[#B42318]">
          {error}
        </p>
      )}

      {rows.length === 0 && (
        <p className="m-0 border-t border-divider px-1 py-6 text-center text-[13px] text-secondary">
          {tasks.length === 0 ? "No open tasks. You're all caught up." : "No tasks in this view."}
        </p>
      )}

      {rows.map((t) => {
        const busy = completing.includes(t.id);
        return (
          <div
            key={t.id}
            className={cx("flex flex-wrap items-center gap-3.5 border-t border-divider px-1 py-3.5 transition-opacity", busy && "opacity-55")}
          >
            <input
              type="checkbox"
              aria-label={`Mark done: ${t.title}`}
              checked={busy}
              disabled={busy || !t.canComplete}
              onChange={() => complete(t)}
              className="m-0 size-5 flex-none cursor-pointer accent-badge-blue disabled:cursor-default"
            />
            <StatusTag status={t.status} className="min-w-24" />
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-[3px]">
              <span className={cx("text-sm font-bold", busy && "line-through")}>{t.title}</span>
              <TaskDetail source={t.source} detail={t.detail} />
            </div>
            <div className="flex min-w-0 flex-[0_1_190px] items-center gap-2.5">
              <Avatar initials={t.patientInitials} size={32} />
              <span className="text-[13px] font-semibold">{t.patientName}</span>
            </div>
            {showAssignee && (
              <span className="inline-flex flex-[0_1_140px] items-center gap-1.5 text-xs text-nav-text">
                <PersonIcon />
                <span className="sr-only">Assigned to</span>
                {t.assigneeName}
              </span>
            )}
            <span className={cx("flex-[0_0_92px] font-mono text-xs font-semibold", DUE_COLORS[t.status])}>
              <span className="sr-only">Due </span>
              {t.dueLabel}
            </span>
            <Link href={`/patients/${t.patientId}`} className="flex-none text-[13px] font-bold text-primary-ink no-underline">
              Open Record →
            </Link>
          </div>
        );
      })}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1.5 min-h-11 cursor-pointer rounded-xl border border-dashed border-primary-line bg-[#F7F9FF] font-sans text-[13px] font-semibold text-primary-ink"
        >
          Show {hidden} more
        </button>
      )}
    </section>
  );
}

/**
 * The source label and the detail. A lab task's detail is "HbA1c 7.3%, above range ·
 * 6 more out of range: …"; the first part sits by the label and the rest gets its
 * own line, cut to fit (the full text is in the tooltip).
 */
function TaskDetail({ source, detail }: { source: "lab" | "staff"; detail: string | null }) {
  const [lead, ...rest] = (detail ?? "").split(" · ");
  const more = rest.join(" · ");
  return (
    <>
      <span className="flex flex-wrap items-center gap-2 text-xs text-secondary">
        <SourceTag source={source} />
        {lead}
      </span>
      {more && (
        <span title={more} className="truncate text-xs text-label">
          {more}
        </span>
      )}
    </>
  );
}
