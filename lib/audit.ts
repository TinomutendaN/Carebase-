import type { Role } from "@/lib/access";
import { sql } from "@/lib/db/client";

/**
 * The audit log. Each call records who (account and role), what (kind and action),
 * which record, and when (set by the database). Failures throw, never fail silently.
 */

/** Who did it. A Session fits this shape; automatic actions use SYSTEM_ACTOR. */
export type Actor = { email: string; role: Role | "system" };

/**
 * Automatic actions with no person behind them, such as follow-up tasks created
 * from lab results. Recorded honestly as the system, not as the assignee.
 */
export const SYSTEM_ACTOR: Actor = { email: "follow-ups@carebase.demo", role: "system" };

/** Which record, e.g. { type: "patient", id: "…", label: "Marcus Holloway" }. */
export type AuditRecord = { type: string; id?: string; label?: string };

type AuditKind = "view" | "change" | "blocked";

async function insert(
  kind: AuditKind,
  actor: Actor,
  action: string,
  record: AuditRecord,
  details?: Record<string, unknown>,
): Promise<number> {
  const rows = await sql`
    INSERT INTO audit_log (account_email, role, kind, action, record_type, record_id, record_label, details)
    VALUES (${actor.email}, ${actor.role}, ${kind}, ${action}, ${record.type},
            ${record.id ?? null}, ${record.label ?? null}, ${details ? JSON.stringify(details) : null})
    RETURNING id
  `;
  return Number(rows[0].id);
}

/** Someone looked at a record, e.g. "Viewed lab results". */
export function logView(actor: Actor, action: string, record: AuditRecord, details?: Record<string, unknown>) {
  return insert("view", actor, action, record, details);
}

/** Someone changed data, e.g. "Approved intake form, created". */
export function logChange(actor: Actor, action: string, record: AuditRecord, details?: Record<string, unknown>) {
  return insert("change", actor, action, record, details);
}

/** Access was refused, e.g. Front Desk "Tried to open lab results". */
export function logBlocked(actor: Actor, action: string, record: AuditRecord, details?: Record<string, unknown>) {
  return insert("blocked", actor, action, record, details);
}
