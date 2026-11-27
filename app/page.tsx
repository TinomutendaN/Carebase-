import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { RoleSwitcher } from "@/components/screens/sign-in/RoleSwitcher";
import { Banner } from "@/components/ui/Banner";
import { ArrowRightIcon, ChatIcon, FileCheckIcon, LogoIcon, PulseIcon } from "@/components/ui/icons";
import type { Role } from "@/lib/access";
import { listDemoAccounts } from "@/lib/db/queries/accounts";

/** Sign in: the Carebase pitch, a link to Tests, and the role switcher. Matches designs/01-sign-in.png. */
export default function SignInPage() {
  return (
    <>
      <Banner />
      <div className="box-border flex flex-1 flex-wrap gap-6 p-6">
        <Pitch />
        <main className="flex min-w-0 flex-[999_1_560px] items-center justify-center py-6">
          <Suspense fallback={<RoleSwitcherFallback />}>
            <AccountsRoleSwitcher />
          </Suspense>
        </main>
      </div>
    </>
  );
}

/** The demo account for each role: the first account holding it, the same one /api/session signs in as. */
async function AccountsRoleSwitcher() {
  const accounts: Partial<Record<Role, string>> = {};
  for (const account of await listDemoAccounts()) accounts[account.role] ??= account.email;
  return <RoleSwitcher accounts={accounts} />;
}

function RoleSwitcherFallback() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading demo accounts"
      className="box-border h-[560px] w-full max-w-[520px] rounded-3xl border border-hairline/90 bg-surface shadow-card"
    />
  );
}

const FEATURES: { icon: ReactNode; text: string }[] = [
  {
    icon: <FileCheckIcon size={16} strokeWidth={2} />,
    text: "Intake forms and referral letters, read by AI and checked by staff before anything is saved",
  },
  { icon: <PulseIcon size={16} strokeWidth={2} />, text: "Patient timelines with lab trends, wearable data and fast search" },
  {
    icon: <ChatIcon size={16} strokeWidth={2} />,
    text: "An assistant that links every answer to its sources and declines clinical decisions",
  },
];

function Pitch() {
  return (
    <section className="on-dark box-border flex max-w-[600px] flex-[1_1_380px] flex-col justify-between gap-10 rounded-3xl border border-white/8 bg-[radial-gradient(520px_260px_at_0%_0%,rgba(45,212,191,0.22),transparent_70%),radial-gradient(620px_320px_at_100%_100%,rgba(124,92,255,0.38),transparent_70%),linear-gradient(160deg,#25216A,#15163F)] p-11 text-white shadow-panel-indigo max-sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-[#3056D3]">
          <LogoIcon size={24} />
        </span>
        <div className="flex flex-col">
          <span className="text-xl font-bold">Carebase</span>
          <span className="text-[11px] tracking-[0.12em] text-[#B8C2E0] uppercase">Clinic operations</span>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <h1 className="m-0 text-[40px] leading-[1.15] font-bold">AI operations for small clinics</h1>
        <p className="m-0 text-base leading-[1.6] text-[#C9D1EA]">
          Turns intake paperwork into patient records, tracks each patient&apos;s health data over time, and gives staff
          an assistant that answers with sources and knows its limits.
        </p>
        <ul className="m-0 mt-2 flex list-none flex-col gap-3.5 p-0">
          {FEATURES.map((f) => (
            <li key={f.text} className="flex items-start gap-3">
              <span className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-white/8 text-[#9FB4FF]">
                {f.icon}
              </span>
              <span className="pt-1.5 text-sm leading-normal text-[#E4E9F7]">{f.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/tests"
        className="flex items-center justify-between gap-4 rounded-2xl border border-white/14 bg-white/6 px-5 py-[18px] no-underline transition-colors hover:bg-white/10"
      >
        <span className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold text-white">View test results</span>
          <span className="text-[13px] text-[#B8C2E0]">See how the assistant is checked. No sign-in needed.</span>
        </span>
        <ArrowRightIcon size={20} strokeWidth={2} className="flex-none text-white" />
      </Link>
    </section>
  );
}
