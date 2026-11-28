import { connection } from "next/server";
import { z } from "zod";
import { can } from "@/lib/access";
import { logBlocked, logChange } from "@/lib/audit";
import { sql } from "@/lib/db/client";
import { addLabResult } from "@/lib/db/queries/labs";
import { DEMO_LABS } from "@/lib/demo-labs";
import { getSession } from "@/lib/session";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const DEMO_CODES = DEMO_LABS.map((l) => l.code) as [string, ...string[]];

const Body = z.object({
  mrn: z.string().trim().min(1).max(20),
  code: z.enum(DEMO_CODES),
  value: z.number().finite().positive().max(10_000),
});

/**
 * POST /api/demo/lab-result — { mrn, code, value }: "Simulate lab result (demo)".
 * Adds the result through addLabResult(), the same path a lab feed would use, so
 * an out-of-range value creates (or updates) a follow-up task by itself. demo_tools only.
 */
export async function POST(request: Request) {
  await connection();
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401, headers: NO_STORE });
  if (!can(session.role, "demo_tools")) {
    await logBlocked(session, "Tried to simulate a lab result", { type: "lab_result", label: "Demo tools" }, { via: "api" });
    return Response.json({ error: "Only Admins can use demo tools." }, { status: 403, headers: NO_STORE });
  }

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Enter an MRN, pick a lab, and enter a number." }, { status: 400, headers: NO_STORE });
  const { mrn, code, value } = body.data;

  const rows = await sql`SELECT id, first_name || ' ' || last_name AS name FROM patients WHERE mrn = ${mrn}`;
  if (rows.length === 0) return Response.json({ error: `No patient with MRN ${mrn}.` }, { status: 404, headers: NO_STORE });
  const patient = { id: rows[0].id as string, name: rows[0].name as string };

  const added = await addLabResult({ patientId: patient.id, code, value });
  const lab = DEMO_LABS.find((l) => l.code === code)!;
  await logChange(session, "Added lab result (demo)", { type: "patient", id: patient.id, label: patient.name }, {
    lab_result_id: added.resultId,
    lab: lab.name,
    value,
    out_of_range: added.outOfRange,
    tasks_created: added.followUps.created.map((t) => t.taskId),
    tasks_updated: added.followUps.updated.map((t) => t.taskId),
  });

  const created = added.followUps.created[0];
  const updated = added.followUps.updated[0];
  const message = created
    ? `Task created for ${patient.name}: ${created.title}.`
    : updated
      ? `${patient.name}'s task for today was updated: ${updated.title}.`
      : added.outOfRange
        ? `Result added for ${patient.name}. Today's task already covers it.`
        : `Result added for ${patient.name}. It's in range, so no task is needed.`;
  return Response.json({ message, created: Boolean(created), updated: Boolean(updated) }, { headers: NO_STORE });
}
