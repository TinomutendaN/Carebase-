import { connection } from "next/server";
import { z } from "zod";
import { ROLES } from "@/lib/access";
import { clearSession, getSession, isTestRunnerKey, signInAsRole } from "@/lib/session";

const signInBody = z.object({ role: z.enum(ROLES), test: z.boolean().optional() });

/** The current session, or null when signed out. */
export async function GET() {
  await connection();
  return Response.json({ session: await getSession() });
}

/**
 * Sign in as the demo account for a role: { role: "front_desk" | "clinician" | "admin" }.
 * The test runner adds test: true and the x-test-key header to sign in as a test account.
 */
export async function POST(request: Request) {
  const parsed = signInBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "role must be front_desk, clinician or admin." }, { status: 400 });
  }
  const test = parsed.data.test === true;
  if (test && !isTestRunnerKey(request.headers.get("x-test-key"))) {
    return Response.json({ error: "Test sign-in needs the test runner's key." }, { status: 403 });
  }
  const session = await signInAsRole(parsed.data.role, { test });
  if (!session) {
    return Response.json({ error: "No account has this role." }, { status: 404 });
  }
  return Response.json({ session });
}

/** Sign out. */
export async function DELETE() {
  await clearSession();
  return Response.json({ session: null });
}
