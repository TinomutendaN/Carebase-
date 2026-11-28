import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { NO_STORE, requireAdminAccess } from "@/lib/admin-access";
import { clinicToday } from "@/lib/clinic-date";
import { AUDIT_KINDS, countAuditEvents, listAuditEvents } from "@/lib/db/queries/audit";

const Query = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  kind: z.enum(["all", ...AUDIT_KINDS]).default("all"),
  tests: z.enum(["0", "1"]).default("0"),
  before: z.coerce.number().int().positive().optional(),
});

/**
 * GET /api/audit?day=YYYY-MM-DD&kind=all|view|change|blocked&tests=0|1&before=<id>
 * One page of a clinic day's audit events, newest first, with the tab counts.
 * Admins only (audit_export). Reading the log is not itself logged.
 */
export async function GET(request: NextRequest) {
  await connection();
  const access = await requireAdminAccess("audit", "GET /api/audit");
  if ("response" in access) return access.response;

  const query = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return Response.json({ error: "Check the day, kind, tests and before values." }, { status: 400, headers: NO_STORE });

  const { kind, tests, before } = query.data;
  const today = clinicToday();
  const day = query.data.day && query.data.day <= today ? query.data.day : today;
  const includeTests = tests === "1";

  const [page, counts] = await Promise.all([
    listAuditEvents({ day, kind, includeTests, before }),
    countAuditEvents(day, includeTests),
  ]);
  return Response.json({ day, today, ...page, counts }, { headers: NO_STORE });
}
