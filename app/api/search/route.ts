import { connection, type NextRequest } from "next/server";
import { can } from "@/lib/access";
import { SEARCH_MIN_LENGTH, searchPatients } from "@/lib/db/queries/patients";
import { getSession } from "@/lib/session";

/**
 * GET /api/search?q= — patients whose name or MRN contains q (at least 2 characters).
 * Returns up to 8 patients, the total number of matches, and the database time in ms.
 */
export async function GET(request: NextRequest) {
  await connection();
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!can(session.role, "patient_records")) return Response.json({ error: "Not allowed." }, { status: 403 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < SEARCH_MIN_LENGTH) {
    return Response.json({ error: `Type at least ${SEARCH_MIN_LENGTH} characters.` }, { status: 400 });
  }
  if (q.length > 100) return Response.json({ error: "Search text is too long." }, { status: 400 });

  return Response.json(await searchPatients(q), { headers: { "Cache-Control": "no-store" } });
}
