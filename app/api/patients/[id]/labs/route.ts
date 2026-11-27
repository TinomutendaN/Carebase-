import { connection, type NextRequest } from "next/server";
import { can } from "@/lib/access";
import { logBlocked, logView } from "@/lib/audit";
import { getLabSeries } from "@/lib/db/queries/labs";
import { getPatient } from "@/lib/db/queries/patients";
import { getSession } from "@/lib/session";

/**
 * GET /api/patients/{id}/labs?code=4548-4 — one lab's results for the last 5 years.
 * Roles without lab access (Front Desk) are refused, and the attempt is logged as blocked.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) return Response.json({ error: "No patient with this id." }, { status: 404 });
  const record = { type: "patient", id: patient.id, label: patient.name };

  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";

  if (!can(session.role, "lab_results")) {
    await logBlocked(session, "Tried to open lab results", record, { via: "api", code: code || null });
    return Response.json({ error: "Your role can't see lab results." }, { status: 403 });
  }

  if (!/^[0-9]{1,7}-[0-9]$/.test(code)) {
    return Response.json({ error: "code must be a LOINC code, e.g. 4548-4." }, { status: 400 });
  }

  const series = await getLabSeries(patient.id, code);
  if (!series) return Response.json({ error: "No results for this lab." }, { status: 404 });

  await logView(session, "Viewed lab results", record, { via: "api", code });
  return Response.json(series, { headers: { "Cache-Control": "no-store" } });
}
