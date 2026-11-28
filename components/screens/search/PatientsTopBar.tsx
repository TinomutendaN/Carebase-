import { redirect } from "next/navigation";
import { PatientSearch } from "@/components/screens/search/PatientSearch";
import { TaskBell, TopBar } from "@/components/shell/TopBar";
import { taskScope } from "@/lib/access";
import { clinicToday } from "@/lib/clinic-date";
import { getRecentlyViewed, type RecentPatient } from "@/lib/db/queries/audit";
import { countDueToday } from "@/lib/db/queries/tasks";
import { getSession } from "@/lib/session";

const ACTIONS = "flex-[0_1_560px] justify-end";

type Heading = { section: string; title: string };
const PATIENTS: Heading = { section: "PATIENTS", title: "Patient record" };

/** A top bar with patient search (this account's recently viewed patients) and the task bell. */
export function SearchTopBar({ section, title, recent, dueToday }: Heading & { recent: RecentPatient[]; dueToday: number }) {
  return (
    <TopBar section={section} title={title} actionsClassName={ACTIONS}>
      <PatientSearch recent={recent} />
      <TaskBell count={dueToday} />
    </TopBar>
  );
}

/** Same bar while the search loads, so nothing jumps. */
export function SearchTopBarFallback({ section, title }: Heading) {
  return (
    <TopBar section={section} title={title} actionsClassName={ACTIONS}>
      <div className="h-[46px] min-w-0 flex-[1_1_320px] rounded-[13px] border-[1.5px] border-field-border bg-surface" />
      <div className="size-11 rounded-xl border border-field-border bg-surface" />
    </TopBar>
  );
}

/** The Patients top bar: loads its own search list and bell count. */
export async function PatientsTopBar() {
  const session = await getSession();
  if (!session) redirect("/");
  const [recent, dueToday] = await Promise.all([
    getRecentlyViewed(session.email),
    countDueToday(taskScope(session.role, session.accountId), clinicToday()),
  ]);
  return <SearchTopBar {...PATIENTS} recent={recent} dueToday={dueToday} />;
}

export function PatientsTopBarFallback() {
  return <SearchTopBarFallback {...PATIENTS} />;
}
