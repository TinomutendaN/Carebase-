import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IntakeReview } from "@/components/screens/intake/IntakeReview";
import { TopBar } from "@/components/shell/TopBar";
import { LockIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { can } from "@/lib/access";
import { logBlocked } from "@/lib/audit";
import { clinicToday } from "@/lib/clinic-date";
import { isDocumentId, listApprovedToday, listPending } from "@/lib/db/queries/intake";
import { documentView } from "@/lib/intake-view";
import { getSession } from "@/lib/session";

/** Intake review (designs/04-intake.png). Front Desk and Admins only. */
export default function IntakePage({ searchParams }: PageProps<"/intake">) {
  return (
    <>
      <TopBar section="INTAKE" title="Intake review">
        <span className="inline-flex items-center gap-2 rounded-xl border border-field-border bg-surface px-3.5 py-2 text-[13px] font-semibold text-nav-text">
          <ShieldCheckIcon size={16} className="text-[#15803D]" />
          Nothing is saved until you approve
        </span>
      </TopBar>
      <Suspense fallback={<IntakeSkeleton />}>
        <IntakeContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function IntakeContent({ searchParams }: { searchParams: PageProps<"/intake">["searchParams"] }) {
  const session = await getSession();
  if (!session) redirect("/");

  if (!can(session.role, "intake")) {
    await logBlocked(session, "Tried to open intake", { type: "intake", label: "Intake" }, { via: "page" });
    return <NoAccess />;
  }

  const { doc } = await searchParams;
  const today = clinicToday();
  const [queue, approved] = await Promise.all([listPending(), listApprovedToday(today)]);

  // The chosen document if it's still waiting; otherwise the oldest one waiting.
  const wanted = typeof doc === "string" && isDocumentId(doc) && queue.some((q) => q.id === doc) ? doc : queue[0]?.id;
  const view = wanted ? await documentView(wanted) : null;

  return <IntakeReview queue={queue} approved={approved} view={view} today={today} />;
}

function NoAccess() {
  return (
    <div className="box-border px-8 pt-6 pb-9 max-sm:px-4">
      <section
        role="alert"
        className="mx-auto flex max-w-[520px] flex-col items-center gap-3 rounded-[22px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft p-8 text-center shadow-card"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-[#FDECEC] text-[#B42318]">
          <LockIcon />
        </span>
        <h2 className="m-0 text-base font-bold">Your role can&apos;t open Intake</h2>
        <p className="m-0 text-[13px] text-secondary">
          Intake is for Front Desk and Admins. This attempt has been recorded in the audit log.
        </p>
      </section>
    </div>
  );
}

function IntakeSkeleton() {
  const block = "rounded-[22px] border border-hairline/90 bg-surface/70";
  return (
    <div aria-busy="true" aria-label="Loading intake" className="box-border flex flex-wrap gap-5 px-8 pt-6 pb-9 max-sm:px-4">
      <div className={`${block} h-[620px] flex-[1_1_280px]`} />
      <div className="h-[620px] flex-[2_1_380px] rounded-[26px] bg-linear-165 from-teal-panel to-teal-panel-deep opacity-90" />
      <div className={`${block} h-[620px] flex-[1.4_1_340px]`} />
    </div>
  );
}
