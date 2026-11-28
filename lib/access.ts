/**
 * Who can see what. The only place role rules live: pages, API routes,
 * assistant tools and tests all read from here. Never hard-code a role check elsewhere.
 * Matches the roles table on the Admin screen (designs/source/06-admin.html).
 */

export const ROLES = ["front_desk", "clinician", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  front_desk: "Front Desk",
  clinician: "Clinician",
  admin: "Admin",
};

/** What each role can see, for the Sign in role switcher. */
export const ROLE_SUMMARIES: Record<Role, string> = {
  front_desk: "Intake, patient records without labs, and your tasks",
  clinician: "Patient records with labs, the assistant, and your tasks",
  admin: "Everything, plus the audit log, roles, and de-identified export",
};

export const AREAS = [
  "intake", "patient_records", "lab_results", "assistant", "tasks", "tasks_all", "audit_export", "demo_tools",
] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  intake: "Intake",
  patient_records: "Patient records",
  lab_results: "Lab results",
  assistant: "Assistant",
  tasks: "Tasks",
  tasks_all: "All tasks",
  audit_export: "Audit log and export",
  demo_tools: "Demo tools",
};

export const ACCESS: Record<Area, Record<Role, boolean>> = {
  intake:          { front_desk: true,  clinician: false, admin: true },
  patient_records: { front_desk: true,  clinician: true,  admin: true },
  lab_results:     { front_desk: false, clinician: true,  admin: true },
  assistant:       { front_desk: false, clinician: true,  admin: true },
  tasks:           { front_desk: true,  clinician: true,  admin: true },
  // Everyone's tasks, with assignees. Without it you see only tasks assigned to you.
  tasks_all:       { front_desk: false, clinician: false, admin: true },
  audit_export:    { front_desk: false, clinician: false, admin: true },
  // "Simulate lab result (demo)" on the Tasks screen.
  demo_tools:      { front_desk: false, clinician: false, admin: true },
};

export function can(role: Role, area: Area): boolean {
  return ACCESS[area][role];
}

/** Whose tasks a list or count covers: everyone's (tasks_all) or only the account's own. */
export type TaskScope = { all: boolean; accountId: number };

export function taskScope(role: Role, accountId: number): TaskScope {
  return { all: can(role, "tasks_all"), accountId };
}

/** You can complete your own tasks; tasks_all lets you complete anyone's. */
export function canCompleteTask(role: Role, accountId: number, assigneeId: number): boolean {
  return assigneeId === accountId || can(role, "tasks_all");
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
