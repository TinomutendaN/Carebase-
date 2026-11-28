import type { Role } from "@/lib/access";
import { sql } from "@/lib/db/client";

export type DemoAccount = { email: string; name: string; initials: string; role: Role };

/** The demo accounts, one per role, for the Sign in screen. */
export async function listDemoAccounts(): Promise<DemoAccount[]> {
  const rows = await sql`SELECT email, name, initials, role FROM accounts WHERE NOT is_test ORDER BY id`;
  return rows as DemoAccount[];
}
