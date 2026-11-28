import { connection } from "next/server";
import { z } from "zod";
import { ROLE_LABELS, ROLES, rolesLeftEmpty } from "@/lib/access";
import { NO_STORE, requireAdminAccess } from "@/lib/admin-access";
import { logBlocked, logChange } from "@/lib/audit";
import { applyRoleChanges, listRoleAccounts } from "@/lib/db/queries/accounts";

const Body = z.object({
  changes: z.array(z.object({ email: z.string(), role: z.enum(ROLES) })).min(1).max(20),
});

/**
 * PATCH /api/roles — { changes: [{ email, role }] }: change demo accounts' roles,
 * checked as a whole so two accounts can swap. Admins only (audit_export).
 * Any change that leaves a role with no account (such as demoting the last Admin)
 * is refused and logged. Takes effect on that account's next request, since the
 * session reads the role from the accounts table every time.
 */
export async function PATCH(request: Request) {
  await connection();
  const access = await requireAdminAccess("roles", "PATCH /api/roles");
  if ("response" in access) return access.response;
  const { session } = access;

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Send changes as [{ email, role }]." }, { status: 400, headers: NO_STORE });
  const { changes } = body.data;

  const accounts = await listRoleAccounts();
  const unknown = changes.filter((c) => !accounts.some((a) => a.email === c.email));
  if (unknown.length > 0) {
    return Response.json({ error: "Only the demo accounts' roles can be changed." }, { status: 400, headers: NO_STORE });
  }

  const empty = rolesLeftEmpty(accounts, changes);
  const applied = empty.length === 0 ? await applyRoleChanges(changes) : null;
  if (!applied) {
    const missing = (empty.length > 0 ? empty : rolesLeftEmpty(await listRoleAccounts(), changes)).map((r) => ROLE_LABELS[r]);
    await logBlocked(session, "Tried to leave a role with no account", { type: "account", label: "Roles" }, {
      via: "api",
      changes,
      empty_roles: missing,
    });
    const which = missing.length > 0 ? missing.join(" or ") : "one role";
    return Response.json(
      { error: `Every role needs at least one account. No account would be ${which}.` },
      { status: 409, headers: NO_STORE },
    );
  }

  for (const c of applied) {
    await logChange(session, "Changed role", { type: "account", id: c.email, label: c.name }, {
      from: ROLE_LABELS[c.from],
      to: ROLE_LABELS[c.to],
    });
  }
  const own = applied.find((c) => c.email === session.email);
  return Response.json(
    { changed: applied.length, ownRole: own ? own.to : session.role },
    { headers: NO_STORE },
  );
}
