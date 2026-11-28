import { connection, type NextRequest } from "next/server";
import { getRun, runChoice } from "@/lib/db/queries/tests";

/**
 * GET /api/tests — the latest test run against the live site, with every result.
 * Public, like the Tests page. ?run=latest-local gives the latest local run instead, ?run=12 run 12.
 */
export async function GET(request: NextRequest) {
  await connection();
  const run = await getRun(runChoice(request.nextUrl.searchParams.get("run") ?? undefined));
  return Response.json({ run }, { headers: { "Cache-Control": "no-store" } });
}
