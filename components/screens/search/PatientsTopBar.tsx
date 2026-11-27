import { redirect } from "next/navigation";
import { PatientSearch } from "@/components/screens/search/PatientSearch";
import { TaskBell, TopBar } from "@/components/shell/TopBar";
import { getRecentlyViewed } from "@/lib/db/queries/audit";
import { countDueToday } from "@/lib/db/queries/tasks";
import { getSession } from "@/lib/session";

const SECTION = "PATIENTS";
const TITLE = "Patient record";
const ACTIONS = "flex-[0_1_560px] justify-end";

/** The Patients top bar: search (with this account's recently viewed patients) and the task bell. */
export async function PatientsTopBar() {
  const session = await getSession();
  if (!session) redirect("/");
  const [recent, dueToday] = await Promise.all([getRecentlyViewed(session.email), countDueToday(session.accountId)]);
  return (
    <TopBar section={SECTION} title={TITLE} actionsClassName={ACTIONS}>
      <PatientSearch recent={recent} />
      <TaskBell count={dueToday} />
    </TopBar>
  );
}

/** Same bar while the search loads, so nothing jumps. */
export function PatientsTopBarFallback() {
  return (
    <TopBar section={SECTION} title={TITLE} actionsClassName={ACTIONS}>
      <div className="h-[46px] min-w-0 flex-[1_1_320px] rounded-[13px] border-[1.5px] border-field-border bg-surface" />
      <div className="size-11 rounded-xl border border-field-border bg-surface" />
    </TopBar>
  );
}
