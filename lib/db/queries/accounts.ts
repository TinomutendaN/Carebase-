import { ROLES, type Role } from "@/lib/access";
import { sql } from "@/lib/db/client";

export type DemoAccount = { email: string; name: string; initials: string; role: Role };

/** The demo accounts, one per role, for the Sign in screen. */
export async function listDemoAccounts(): Promise<DemoAccount[]> {
  const rows = await sql`SELECT email, name, initials, role FROM accounts WHERE NOT is_test ORDER BY id`;
  return rows as DemoAccount[];
}

export type RoleAccount = DemoAccount & { id: number };

/** The real demo accounts for the Admin roles panel (test runner accounts left out). */
export async function listRoleAccounts(): Promise<RoleAccount[]> {
  const rows = await sql`SELECT id::int, email, name, initials, role FROM accounts WHERE NOT is_test ORDER BY id`;
  return rows as RoleAccount[];
}

export type RoleChange = { email: string; role: Role };
export type AppliedChange = { email: string; name: string; from: Role; to: Role };

/**
 * Applies role changes to demo accounts in one statement. The statement checks the
 * end state itself: if any role would be left with no demo account, nothing changes
 * and it returns null. So two Admins saving at once can never leave a role empty.
 */
export async function applyRoleChanges(changes: RoleChange[]): Promise<AppliedChange[] | null> {
  const emails = changes.map((c) => c.email);
  const roles = changes.map((c) => c.role);
  const rows = await sql`
    WITH changes AS (
      SELECT * FROM unnest(${emails}::text[], ${roles}::text[]) AS c(email, role)
    ),
    end_state AS (
      SELECT coalesce(c.role, a.role) AS role
      FROM accounts a LEFT JOIN changes c ON c.email = a.email
      WHERE NOT a.is_test
    ),
    ok AS (
      SELECT count(DISTINCT role) = ${ROLES.length} AS ok FROM end_state
    ),
    updated AS (
      UPDATE accounts a SET role = c.role
      FROM changes c, accounts old, ok
      WHERE a.email = c.email AND old.id = a.id AND NOT a.is_test AND a.role <> c.role AND ok.ok
      RETURNING a.email, a.name, old.role AS from_role, a.role AS to_role
    )
    SELECT (SELECT ok FROM ok) AS ok, coalesce(json_agg(updated), '[]'::json) AS updated FROM updated
  `;
  if (!rows[0].ok) return null;
  return (rows[0].updated as { email: string; name: string; from_role: Role; to_role: Role }[]).map((r) => ({
    email: r.email, name: r.name, from: r.from_role, to: r.to_role,
  }));
}
