import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccessTable } from "@/components/screens/admin/AccessTable";
import { AuditLog } from "@/components/screens/admin/AuditLog";
import { ExportPanel } from "@/components/screens/admin/ExportPanel";
import { RolesPanel } from "@/components/screens/admin/RolesPanel";
import { TopBar } from "@/components/shell/TopBar";
import { can } from "@/lib/access";
import { logBlocked } from "@/lib/audit";
import { clinicClock, clinicDate, clinicToday } from "@/lib/clinic-date";
import { listRoleAccounts } from "@/lib/db/queries/accounts";
import { countAuditEvents, getLastExport, listAuditEvents } from "@/lib/db/queries/audit";
import { countPatients, loadPreviewPatient } from "@/lib/db/queries/export";
import { previewRows } from "@/lib/deidentify";
import { formatDatePadded, formatDayMonth } from "@/lib/format";
import { getSession } from "@/lib/session";

/** The patient shown in the export preview (the same check patient as Steps 5 and 9). */
const PREVIEW_MRN = "76057";

/**
 * Admin (designs/06-admin.png): the audit log, the de-identified export and roles.
 * Admins only (audit_export); the APIs behind it check the same rule.
 */
export default function AdminPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminScreen />
    </Suspense>
  );
}

async function AdminScreen() {
  const session = await getSession();
  if (!session) redirect("/");
  if (!can(session.role, "audit_export")) {
    await logBlocked(session, "Tried to open the audit log", { type: "admin", label: "Admin" }, { via: "page" });
    redirect("/dashboard");
  }

  const today = clinicToday();
  const [page, counts, accounts, patientCount, preview, lastExport] = await Promise.all([
    listAuditEvents({ day: today, kind: "all", includeTests: false }),
    countAuditEvents(today, false),
    listRoleAccounts(),
    countPatients(),
    loadPreviewPatient(PREVIEW_MRN),
    getLastExport(),
  ]);

  const previewFields = preview
    ? previewRows(preview.patient, preview.latestLabDate, { today: new Date(), patientCount, format: formatDatePadded })
    : [];

  let lastExportLabel: string | null = null;
  if (lastExport) {
    const { time, zone } = clinicClock(lastExport.occurredAt);
    const day = clinicDate(new Date(lastExport.occurredAt));
    lastExportLabel = `${time} ${zone} ${day === today ? "today" : formatDayMonth(day)} by ${lastExport.name}`;
  }

  return (
    <>
      <AdminTopBar />
      <div className="box-border flex flex-wrap items-start gap-5 px-8 pt-6 pb-9 max-sm:px-4">
        <AuditLog initial={{ day: today, today, ...page, counts }} />
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
          <ExportPanel patientCount={patientCount} preview={previewFields} lastExport={lastExportLabel} />
          <section
            aria-labelledby="roles-title"
            className="flex flex-col gap-3.5 rounded-[22px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft p-5 shadow-card"
          >
            <div className="flex flex-col gap-[3px]">
              <h2 id="roles-title" className="m-0 text-[17px] font-bold">Roles</h2>
              <span className="text-[13px] text-secondary">Who can see what</span>
            </div>
            <RolesPanel accounts={accounts} currentEmail={session.email} />
            <AccessTable />
          </section>
        </div>
      </div>
    </>
  );
}

function AdminTopBar() {
  return (
    <TopBar section="ADMIN" title="Admin">
      <span className="inline-flex items-center gap-2 rounded-xl border border-field-border bg-surface px-3.5 py-2 text-[13px] font-semibold text-nav-text">
        <span aria-hidden="true" className="size-2 rounded-full bg-green shadow-[0_0_8px_#22C55E]" />
        Audit logging on since day one
      </span>
    </TopBar>
  );
}

function AdminSkeleton() {
  const block = "rounded-[22px] border border-hairline/90 bg-surface/70";
  return (
    <>
      <AdminTopBar />
      <div aria-busy="true" aria-label="Loading Admin" className="box-border flex flex-wrap items-start gap-5 px-8 pt-6 pb-9 max-sm:px-4">
        <div className={`${block} h-[900px] flex-[999_1_560px]`} />
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
          <div className="h-[540px] rounded-[26px] bg-linear-165 from-teal-panel to-teal-panel-deep opacity-90" />
          <div className={`${block} h-[640px]`} />
        </div>
      </div>
    </>
  );
}
