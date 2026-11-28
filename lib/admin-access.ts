import { can } from "@/lib/access";
import { logBlocked, type AuditRecord } from "@/lib/audit";
import { getSession, type Session } from "@/lib/session";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

/** What each Admin API logs when a role without audit_export tries it. */
const REFUSALS = {
  audit: { action: "Tried to open the audit log", record: { type: "admin", label: "Admin" } },
  export: { action: "Tried to export de-identified data", record: { type: "export", label: "De-identified export" } },
  roles: { action: "Tried to change a role", record: { type: "account", label: "Roles" } },
} satisfies Record<string, { action: string; record: AuditRecord }>;

/**
 * The check every Admin API route runs first, before reading the request body.
 * Signed out → 401. A role without audit_export (lib/access.ts) → 403, and the
 * attempt is logged as blocked.
 */
export async function requireAdminAccess(
  what: keyof typeof REFUSALS,
  route: string,
): Promise<{ session: Session } | { response: Response }> {
  const session = await getSession();
  if (!session) return { response: Response.json({ error: "Sign in first." }, { status: 401, headers: NO_STORE }) };
  if (!can(session.role, "audit_export")) {
    const { action, record } = REFUSALS[what];
    await logBlocked(session, action, record, { via: "api", route });
    return { response: Response.json({ error: "Only Admins can do this." }, { status: 403, headers: NO_STORE }) };
  }
  return { session };
}
