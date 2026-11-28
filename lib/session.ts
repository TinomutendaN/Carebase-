import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { isRole, type Role } from "@/lib/access";
import { sql } from "@/lib/db/client";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Demo sign-in. The httpOnly cookie holds the account email; the account's
 * current role is always read from the accounts table, the single source of truth.
 */

const MAX_AGE_SECONDS = 60 * 60 * 8;

export type Session = {
  accountId: number;
  email: string;
  name: string;
  initials: string;
  role: Role;
  /** A test runner account (scripts/run-tests.ts), not a demo account. */
  isTest: boolean;
};

type AccountRow = { id: string; email: string; name: string; initials: string; role: string; is_test: boolean };

function toSession(row: AccountRow | undefined): Session | null {
  if (!row || !isRole(row.role)) return null;
  return { accountId: Number(row.id), email: row.email, name: row.name, initials: row.initials, role: row.role, isTest: row.is_test };
}

/**
 * The signed-in account, or null if signed out or the email isn't a known account.
 * Cached per request, so a page and its parts share one lookup.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const email = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!email) return null;
  const rows = (await sql`
    SELECT id, email, name, initials, role, is_test FROM accounts WHERE email = ${email}
  `) as AccountRow[];
  return toSession(rows[0]);
});

/**
 * Sign in as the demo account that holds this role. Returns null if no account has it.
 * Route handlers and server actions only.
 */
export async function signInAsRole(role: Role, { test = false }: { test?: boolean } = {}): Promise<Session | null> {
  const rows = (await sql`
    SELECT id, email, name, initials, role, is_test FROM accounts WHERE role = ${role} AND is_test = ${test} ORDER BY id LIMIT 1
  `) as AccountRow[];
  const session = toSession(rows[0]);
  if (!session) return null;

  (await cookies()).set(SESSION_COOKIE, session.email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return session;
}

/**
 * True when the request carries the test runner's key (TEST_RUNNER_SECRET), so it may
 * sign in as a test account. Always false when the secret isn't set.
 */
export function isTestRunnerKey(key: string | null): boolean {
  const secret = process.env.TEST_RUNNER_SECRET?.trim();
  if (!secret || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Sign out. Route handlers and server actions only. */
export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
