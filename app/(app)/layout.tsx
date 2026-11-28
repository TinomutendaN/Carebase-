import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Sidebar, SidebarSkeleton } from "@/components/shell/Sidebar";
import { Banner } from "@/components/ui/Banner";
import { taskScope } from "@/lib/access";
import { getSidebarCounts } from "@/lib/db/queries/sidebar";
import { getSession } from "@/lib/session";

/** The signed-in shell: banner, role-filtered sidebar, and the page (top bar + content). */
export default function SignedInLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Banner />
      {/* Wraps on narrow screens, so the sidebar stacks above the content (as in the designs). */}
      <div className="flex flex-1 flex-wrap">
        <Suspense fallback={<SidebarSkeleton />}>
          <SessionSidebar />
        </Suspense>
        <div className="flex min-w-0 flex-[999_1_560px] flex-col">{children}</div>
      </div>
    </>
  );
}

async function SessionSidebar() {
  const session = await getSession();
  // proxy.ts only checks the cookie exists; this checks it names a real account.
  if (!session) redirect("/");

  const counts = await getSidebarCounts(taskScope(session.role, session.accountId));
  return <Sidebar role={session.role} account={session} counts={counts} />;
}
