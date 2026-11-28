import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AutoFollowUps } from "@/components/screens/tasks/AutoFollowUps";
import { TaskList, type TaskListItem } from "@/components/screens/tasks/TaskList";
import { TaskSummary } from "@/components/screens/tasks/TaskSummary";
import { TopBar } from "@/components/shell/TopBar";
import { can, canCompleteTask, taskScope } from "@/lib/access";
import { clinicToday } from "@/lib/clinic-date";
import { getLatestAutoTask, getTaskSummary, listOpenTasks } from "@/lib/db/queries/tasks";
import { formatDayMonth, formatWeekdayDate } from "@/lib/format";
import { getSession } from "@/lib/session";

/** Rows shown before "Show N more" on the all-tasks list. */
const ALL_TASKS_PAGE_SIZE = 8;

/**
 * Tasks (designs/05-tasks-*.png). Everyone sees tasks assigned to them; tasks_all
 * (Admin) sees everyone's, with assignees. Overdue and due today use the clinic's date.
 */
export default function TasksPage() {
  return (
    <Suspense fallback={<TasksSkeleton />}>
      <TasksScreen />
    </Suspense>
  );
}

async function TasksScreen() {
  const session = await getSession();
  if (!session) redirect("/");
  if (!can(session.role, "tasks")) redirect("/dashboard");

  const today = clinicToday();
  const scope = taskScope(session.role, session.accountId);
  const showLabs = can(session.role, "lab_results");

  const [tasks, summary, latest] = await Promise.all([
    listOpenTasks(scope, today),
    getTaskSummary(scope, today),
    // Lab values only for roles that may see them.
    showLabs ? getLatestAutoTask() : null,
  ]);

  const items: TaskListItem[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    detail: t.detail,
    source: t.source,
    status: t.status,
    dueLabel: t.status === "today" ? "Today" : formatDayMonth(t.dueOn),
    patientId: t.patientId,
    patientName: t.patientName,
    patientInitials: t.patientInitials,
    assigneeName: t.assigneeName,
    canComplete: canCompleteTask(session.role, session.accountId, t.assigneeId),
  }));

  return (
    <>
      <TasksTopBar title={scope.all ? "All tasks" : "My tasks"} today={today} />
      <div className="box-border flex flex-col gap-5 px-8 pt-6 pb-9 max-sm:px-4">
        <TaskSummary summary={summary} />
        <div className="flex flex-wrap items-start gap-5">
          <TaskList
            title={scope.all ? "Everyone’s tasks, most urgent first" : "Assigned to you, most urgent first"}
            tasks={items}
            showAssignee={scope.all}
            pageSize={scope.all ? ALL_TASKS_PAGE_SIZE : undefined}
          />
          <AutoFollowUps latest={latest} showLabs={showLabs} showDemo={can(session.role, "demo_tools")} />
        </div>
      </div>
    </>
  );
}

function TasksTopBar({ title, today }: { title: string; today?: string }) {
  return (
    <TopBar section="TASKS" title={title}>
      {today && <span className="text-[13px] text-secondary">{formatWeekdayDate(today)}</span>}
    </TopBar>
  );
}

function TasksSkeleton() {
  const block = "rounded-[18px] border border-hairline/90 bg-surface/70";
  return (
    <>
      <TasksTopBar title="Tasks" />
      <div aria-busy="true" aria-label="Loading tasks" className="box-border flex flex-col gap-5 px-8 pt-6 pb-9 max-sm:px-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${block} h-[74px]`} />
          ))}
        </div>
        <div className="flex flex-wrap items-start gap-5">
          <div className={`${block} h-[560px] flex-[999_1_560px] rounded-[22px]`} />
          <div className="h-[560px] flex-[1_1_320px] rounded-[26px] bg-linear-165 from-teal-panel to-teal-panel-deep opacity-90" />
        </div>
      </div>
    </>
  );
}
