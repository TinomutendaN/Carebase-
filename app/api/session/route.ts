import { connection } from "next/server";
import { z } from "zod";
import { ROLES } from "@/lib/access";
import { clearSession, getSession, signInAsRole } from "@/lib/session";

const signInBody = z.object({ role: z.enum(ROLES) });

/** The current session, or null when signed out. */
export async function GET() {
  await connection();
  return Response.json({ session: await getSession() });
}

/** Sign in as the demo account for a role: { role: "front_desk" | "clinician" | "admin" }. */
export async function POST(request: Request) {
  const parsed = signInBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "role must be front_desk, clinician or admin." }, { status: 400 });
  }
  const session = await signInAsRole(parsed.data.role);
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
