"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { ROLE_LABELS, ROLE_SUMMARIES, ROLES, type Role } from "@/lib/access";
import { cx } from "@/lib/cx";
import { ArrowRightIcon, CheckCircleIcon } from "@/components/ui/icons";

const SHORT: Record<Role, string> = { front_desk: "FD", clinician: "CL", admin: "AD" };

/**
 * The Sign in card: pick a role, then "Continue as [role]" signs in through
 * /api/session and opens the Dashboard. A radio group, so arrow keys move the pick.
 */
export function RoleSwitcher({ accounts }: { accounts: Partial<Record<Role, string>> }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("clinician");
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const refs = useRef<Partial<Record<Role, HTMLButtonElement | null>>>({});

  function pick(next: Role) {
    setRole(next);
    setStatus("idle");
  }

  function onKeyDown(event: KeyboardEvent) {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = ROLES[(ROLES.indexOf(role) + step + ROLES.length) % ROLES.length];
    pick(next);
    refs.current[next]?.focus();
  }

  async function signIn() {
    setStatus("busy");
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }).catch(() => null);
    if (!response?.ok) {
      setStatus("error");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="box-border flex w-full max-w-[520px] flex-col gap-6 rounded-3xl border border-hairline/90 bg-surface p-10 shadow-[0_1px_2px_rgba(40,52,120,0.05),0_24px_60px_rgba(40,52,120,0.12)] max-sm:p-6">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-[28px] font-bold">Sign in to the demo</h2>
        <p className="m-0 text-[15px] leading-normal text-secondary">Choose a role. Each one sees different screens and data.</p>
      </div>

      <div role="radiogroup" aria-label="Choose a role" className="flex flex-col gap-3" onKeyDown={onKeyDown}>
        {ROLES.map((r) => {
          const on = r === role;
          const email = accounts[r];
          return (
            <button
              key={r}
              ref={(el) => {
                refs.current[r] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => pick(r)}
              className={cx(
                "flex w-full cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 text-left transition-colors",
                on ? "border-[#3056D3] bg-[#F4F6FF]" : "border-[#E3E7F2] bg-surface hover:border-primary-line",
              )}
            >
              <span
                className={cx(
                  "flex size-11 flex-none items-center justify-center rounded-xl text-[15px] font-bold",
                  on ? "bg-[#3056D3] text-white" : "bg-[#EEF0FB] text-nav-text",
                )}
              >
                {SHORT[r]}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-base font-semibold text-ink">{ROLE_LABELS[r]}</span>
                <span className="text-[13px] leading-[1.45] text-secondary">{ROLE_SUMMARIES[r]}</span>
                <span className="text-xs text-secondary">
                  {email ? `Demo account: ${email}` : "No demo account has this role"}
                </span>
              </span>
              {on && <CheckCircleIcon size={22} strokeWidth={2.4} className="flex-none text-[#3056D3]" />}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={signIn}
        disabled={status === "busy" || !accounts[role]}
        className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[14px] border-none bg-[#3056D3] text-base font-semibold text-white transition-opacity disabled:cursor-wait disabled:opacity-70"
      >
        <span>{status === "busy" ? "Signing in…" : `Continue as ${ROLE_LABELS[role]}`}</span>
        <ArrowRightIcon size={18} strokeWidth={2} />
      </button>
      {status === "error" && (
        <p role="alert" className="m-0 -mt-2 text-center text-[13px] text-red">
          Couldn&apos;t sign in. Please try again.
        </p>
      )}
    </div>
  );
}
