"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ROLE_LABELS, ROLES, rolesLeftEmpty, type Role } from "@/lib/access";
import type { RoleAccount } from "@/lib/db/queries/accounts";
import { cx } from "@/lib/cx";

/**
 * The demo accounts with a role dropdown each. Changes are staged and saved
 * together (PATCH /api/roles), so two accounts can swap roles: with three accounts
 * and three roles, any single change would leave a role empty and be refused.
 */
export function RolesPanel({ accounts, currentEmail }: { accounts: RoleAccount[]; currentEmail: string }) {
  const router = useRouter();
  const [staged, setStaged] = useState<Record<string, Role>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  const changes = accounts
    .filter((a) => staged[a.email] && staged[a.email] !== a.role)
    .map((a) => ({ email: a.email, role: staged[a.email] }));
  const empty = rolesLeftEmpty(accounts, changes);

  function pick(email: string, role: Role) {
    setMessage(null);
    setStaged((s) => ({ ...s, [email]: role }));
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "The roles couldn't be saved. Try again.");
      setStaged({});
      // Your own role changed and may no longer open Admin: leave before the page re-checks.
      if (body.ownRole !== "admin") {
        router.push("/dashboard");
        return;
      }
      setMessage({ tone: "ok", text: `Saved. ${body.changed === 1 ? "The change applies" : "The changes apply"} on that account’s next request.` });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "The roles couldn't be saved. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      {accounts.map((a) => {
        const value = staged[a.email] ?? a.role;
        return (
          <div key={a.email} className="flex items-center gap-2.5">
            <Avatar initials={a.initials} size={34} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] font-semibold">
                {a.name}
                {a.email === currentEmail && <span className="font-medium text-label"> · you</span>}
              </span>
              <span className="truncate text-[11px] text-label">{a.email}</span>
            </span>
            <label className="flex">
              <span className="sr-only">Role for {a.name}</span>
              <select
                value={value}
                disabled={busy}
                onChange={(e) => pick(a.email, e.target.value as Role)}
                className={cx(
                  "h-9 cursor-pointer rounded-[10px] border px-2.5 font-sans text-[13px] font-semibold text-primary-ink",
                  value !== a.role ? "border-amber bg-[#FFF8E6]" : "border-field-border bg-[#F7F9FF]",
                )}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </label>
          </div>
        );
      })}

      {changes.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-dashed border-primary-line bg-[#F7F9FF] p-3">
          <span className="text-xs text-secondary">
            {empty.length > 0
              ? `No account would be ${empty.map((r) => ROLE_LABELS[r]).join(" or ")}. Every role needs at least one account; swap roles instead.`
              : `${changes.length} ${changes.length === 1 ? "change" : "changes"} ready to save.`}
          </span>
          <div className="flex gap-2">
            <Button size="md" disabled={busy} onClick={save} className="flex-1">
              {busy ? "Saving…" : "Save changes"}
            </Button>
            <Button
              size="md"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setStaged({});
                setMessage(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={cx(
            "m-0 rounded-xl px-3.5 py-2.5 text-[13px] font-medium",
            message.tone === "error" ? "bg-[#FDECEC] text-[#B42318]" : "bg-[#E3F6EC] text-[#166534]",
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
