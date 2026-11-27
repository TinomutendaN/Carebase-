import { can } from "@/lib/access";
import { logBlocked } from "@/lib/audit";
import { getSession, type Session } from "@/lib/session";

/**
 * The check every intake API route runs first. Signed out → 401. A role without
 * intake access (lib/access.ts) → 403, and the attempt is logged as blocked.
 */
export async function requireIntakeAccess(route: string): Promise<{ session: Session } | { response: Response }> {
  const session = await getSession();
  if (!session) return { response: Response.json({ error: "Sign in first." }, { status: 401 }) };
  if (!can(session.role, "intake")) {
    await logBlocked(session, "Tried to open intake", { type: "intake", label: "Intake" }, { via: "api", route });
    return { response: Response.json({ error: "Your role can't open Intake." }, { status: 403 }) };
  }
  return { session };
}

export const NO_STORE = { "Cache-Control": "no-store" } as const;
