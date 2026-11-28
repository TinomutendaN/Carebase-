import { connection } from "next/server";
import { NO_STORE, requireAdminAccess } from "@/lib/admin-access";
import { logChange } from "@/lib/audit";
import { clinicToday } from "@/lib/clinic-date";
import { EXPORTED_DATA } from "@/lib/db/queries/audit";
import { loadExportSource } from "@/lib/db/queries/export";
import { deidentify } from "@/lib/deidentify";

/**
 * POST /api/export — downloads the de-identified export as one JSON file
 * (rules in lib/deidentify.ts). Admins only (audit_export); everyone else gets
 * 403 and a blocked row. Every export is logged with how many patients it held.
 */
export async function POST() {
  await connection();
  const access = await requireAdminAccess("export", "POST /api/export");
  if ("response" in access) return access.response;

  const today = clinicToday();
  const { file } = deidentify(await loadExportSource(), { today: new Date(), exportedOn: today });
  const body = JSON.stringify(file);
  const labs = file.patients.reduce((n, p) => n + p.labs.length, 0);

  await logChange(access.session, EXPORTED_DATA, { type: "export", label: `${file.patient_count} patients` }, {
    patients: file.patient_count,
    lab_results: labs,
    redacted_fields: file.redacted_fields,
    format: "json",
    bytes: Buffer.byteLength(body),
  });

  return new Response(body, {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="carebase-deidentified-${today}.json"`,
    },
  });
}
