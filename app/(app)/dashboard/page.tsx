import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LabLegend } from "@/components/charts/LabTrendChart";
import { StatCards, type StatCard } from "@/components/screens/dashboard/StatCards";
import { UrgentTasks, type UrgentTask } from "@/components/screens/dashboard/UrgentTasks";
import { LabTrendsPanel } from "@/components/screens/patient/LabTrendsPanel";
import { WearableCards } from "@/components/screens/patient/WearableCards";
import { SearchTopBar, SearchTopBarFallback } from "@/components/screens/search/PatientsTopBar";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon, ClockIcon, FileIcon, FlaskIcon, PeopleIcon, PulseIcon, TasksIcon } from "@/components/ui/icons";
import { can, taskScope, type Role } from "@/lib/access";
import { logView } from "@/lib/audit";
import { addDays, clinicToday, weekStart } from "@/lib/clinic-date";
import { getRecentlyViewed } from "@/lib/db/queries/audit";
import { listPending } from "@/lib/db/queries/intake";
import { countOutOfRange, getLabSeries, getMainLabCodes, getTaskLab, type LabCode } from "@/lib/db/queries/labs";
import { countPatients, getPatient, getWearables, searchPatients } from "@/lib/db/queries/patients";
import { countDueToday, getTaskSummary, listOpenTasks, type TaskRow } from "@/lib/db/queries/tasks";
import { getRun } from "@/lib/db/queries/tests";
import { formatDayMonth } from "@/lib/format";
import { getSession, type Session } from "@/lib/session";

const HEADING = { section: "OVERVIEW", title: "Dashboard" };

/** With no open tasks, the spotlight shows the demo's check patient. */
const FALLBACK_MRN = "76057"; // Bert Hammes

/** The number cards that exist, each from the same query as the screen it opens. */
type CardKey = "intake" | "tasks" | "dueToday" | "labs" | "patientsAdded" | "patients" | "tests";

/** Which cards a role gets, in the design's order. Everything is decided by lib/access.ts areas. */
function cardKeys(role: Role): CardKey[] {
  const all = can(role, "tasks_all");
  const labs = can(role, "lab_results");
  const order: CardKey[] = all
    ? ["patients", "tasks", "intake", "tests"]
    : ["intake", "tasks", "dueToday", "labs", "patientsAdded", "patients"];
  const has: Record<CardKey, boolean> = {
    intake: can(role, "intake"),
    tasks: can(role, "tasks"),
    dueToday: can(role, "tasks"),
    labs: labs,
    patientsAdded: !labs,
    patients: labs,
    tests: can(role, "audit_export"),
  };
  return order.filter((k) => has[k]);
}

/**
 * The Dashboard (designs/02-dashboard-*.png): number cards for the role, the
 * patient spotlight (the patient on the most urgent task this role can see), and
 * the three most urgent tasks.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/");

  const today = clinicToday();
  const monday = weekStart(today);
  const scope = taskScope(session.role, session.accountId);
  const keys = cardKeys(session.role);
  const wants = (k: CardKey) => keys.includes(k);

  // Everything in parallel; the spotlight starts as soon as the task list arrives.
  const tasksLoaded = listOpenTasks(scope, today);
  const [tasks, summary, pending, patients, outOfRange, run, recent, bell, spotlight] = await Promise.all([
    tasksLoaded,
    getTaskSummary(scope, today),
    wants("intake") ? listPending() : null,
    wants("patients") || wants("patientsAdded") ? countPatients(monday) : null,
    wants("labs") ? countOutOfRange(monday, today) : null,
    wants("tests") ? getRun({ kind: "live" }) : null,
    getRecentlyViewed(session.email),
    countDueToday(scope, today),
    tasksLoaded.then((t) => loadSpotlight(session, t[0] ?? null)),
  ]);

  const nextToday = tasks.find((t) => t.status === "today");
  const cards: Record<CardKey, () => StatCard> = {
    intake: () => ({
      key: "intake", icon: <FileIcon strokeWidth={2} />, color: "blue",
      value: String(pending!.length), label: "Intake forms waiting for review",
      meta: `${pending!.filter((d) => d.flagged).length} flagged`, link: "Open Intake", href: "/intake",
    }),
    tasks: () => ({
      key: "tasks", icon: <TasksIcon strokeWidth={2} />, color: "purple",
      value: String(summary.open), label: scope.all ? "All open tasks" : "Your open tasks",
      meta: `${summary.overdue} overdue`, link: "Open Tasks", href: "/tasks",
    }),
    dueToday: () => ({
      key: "dueToday", icon: <ClockIcon strokeWidth={2} />, color: "amber",
      value: String(summary.dueToday), label: "Tasks due today",
      meta: nextToday ? `Next: ${nextToday.patientName}` : "Nothing due today", link: "Open Tasks", href: "/tasks",
    }),
    labs: () => ({
      key: "labs", icon: <PulseIcon strokeWidth={2} />, color: "blue",
      value: String(outOfRange!.total), label: "Out-of-range lab results this week",
      meta: `${outOfRange!.high} high, ${outOfRange!.low} low`, link: "Open Tasks", href: "/tasks",
    }),
    patientsAdded: () => ({
      key: "patientsAdded", icon: <PeopleIcon strokeWidth={2} />, color: "green",
      value: String(patients!.addedThisWeek), label: "Patients added this week",
      meta: `of ${patients!.total} patients`, link: "Open Patients", href: "/patients",
    }),
    patients: () => ({
      key: "patients", icon: <PeopleIcon strokeWidth={2} />, color: "green",
      value: String(patients!.total), label: "Patients",
      meta: `+${patients!.addedThisWeek} this week`, link: "Open Patients", href: "/patients",
    }),
    tests: () => ({
      key: "tests", icon: <FlaskIcon strokeWidth={2} />, color: "amber",
      value: run ? `${run.passed} of ${run.total}` : "—", label: "Tests passing",
      meta: !run ? "No live run yet" : run.total > run.passed ? `${run.total - run.passed} failing` : "All passing",
      link: "Open Tests", href: "/tests",
    }),
  };

  const urgent: UrgentTask[] = tasks.slice(0, 3).map((t) => ({
    id: t.id,
    title: t.title,
    detail: t.detail,
    tag: t.status === "upcoming" && t.dueOn === addDays(today, 1) ? "tomorrow" : t.status,
    dueLabel:
      t.status === "overdue" ? `Was due ${formatDayMonth(t.dueOn)}`
      : t.status === "today" ? "Due today"
      : t.dueOn === addDays(today, 1) ? "Due tomorrow"
      : `Due ${formatDayMonth(t.dueOn)}`,
    patientId: t.patientId,
    patientName: t.patientName,
    patientInitials: t.patientInitials,
    assigneeName: scope.all ? t.assigneeName : null,
  }));

  return (
    <>
      <SearchTopBar {...HEADING} recent={recent} dueToday={bell} />
      <div className="box-border flex flex-col gap-6 px-8 pt-7 pb-9 max-sm:px-4">
        <StatCards cards={keys.map((k) => cards[k]())} />
        {spotlight}
        <UrgentTasks tasks={urgent} allTasks={scope.all} />
      </div>
    </>
  );
}

/**
 * The spotlight panel for the patient on the most urgent task (Bert Hammes when
 * there are none). Showing it counts as viewing the record, and its labs as
 * viewing lab results, so both are logged as on the Patient page.
 */
async function loadSpotlight(session: Session, task: TaskRow | null) {
  const patientId = task?.patientId ?? (await searchPatients(FALLBACK_MRN)).patients.find((p) => p.mrn === FALLBACK_MRN)?.id;
  if (!patientId) return null;

  if (!can(session.role, "patient_records")) return null;
  const showLabs = can(session.role, "lab_results");
  const [patient, wearables, mainLabs, taskLab] = await Promise.all([
    getPatient(patientId),
    getWearables(patientId),
    showLabs ? getMainLabCodes(patientId) : null,
    showLabs && task?.source === "lab" ? getTaskLab(task.id) : null,
  ]);
  if (!patient) return null;

  // Open on the lab the task is about. Its code replaces a switcher lab with the same
  // name (glucose has two codes); otherwise it's added in front.
  const labs: LabCode[] | null =
    mainLabs && taskLab && !mainLabs.some((l) => l.code === taskLab.code)
      ? mainLabs.some((l) => l.name === taskLab.name)
        ? mainLabs.map((l) => (l.name === taskLab.name ? taskLab : l))
        : [taskLab, ...mainLabs]
      : mainLabs;
  const first = taskLab?.code ?? labs?.[0]?.code;

  const record = { type: "patient", id: patient.id, label: patient.name };
  const codes = labs?.map((l) => l.code) ?? [];
  const [initial] = await Promise.all([
    first ? getLabSeries(patient.id, first) : null,
    logView(session, "Viewed record", record, { via: "dashboard" }),
    codes.length ? logView(session, "Viewed lab results", record, { via: "dashboard", codes }) : null,
  ]);

  return (
    <LabTrendsPanel
      patientId={patient.id}
      labs={labs}
      initial={initial}
      spotlight={{
        subtitle: `${patient.name.toUpperCase()} · MRN ${patient.mrn}`,
        lockedSubtitle: task ? task.title.toUpperCase() : "WEARABLES ONLY",
        lockedNote: task ? `Your task: ${task.title}.` : undefined,
        action: (
          <Button href={`/patients/${patient.id}`} variant="ghost-dark" icon={<ArrowRightIcon size={14} strokeWidth={2.2} />}>
            Open Record
          </Button>
        ),
        footer: <LabLegend note="Synthetic patient · values for demo only" />,
      }}
    >
      <WearableCards wearables={wearables} label="WEARABLES · LAST 14 DAYS" />
    </LabTrendsPanel>
  );
}

function DashboardSkeleton() {
  const block = "rounded-[20px] border border-hairline/90 bg-surface/70";
  return (
    <>
      <SearchTopBarFallback {...HEADING} />
      <div aria-busy="true" aria-label="Loading dashboard" className="box-border flex flex-col gap-6 px-8 pt-7 pb-9 max-sm:px-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-[18px]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${block} h-[196px]`} />
          ))}
        </div>
        <div className="h-[560px] rounded-[26px] bg-linear-165 from-teal-panel to-teal-panel-deep opacity-90" />
        <div className="h-[300px] rounded-3xl bg-linear-160 from-indigo-panel to-indigo-panel-deep opacity-90" />
      </div>
    </>
  );
}
