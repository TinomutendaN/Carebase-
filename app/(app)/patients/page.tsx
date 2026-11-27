import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PatientsTopBar, PatientsTopBarFallback } from "@/components/screens/search/PatientsTopBar";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ArrowRightIcon, SearchIcon } from "@/components/ui/icons";
import { getRecentlyViewed } from "@/lib/db/queries/audit";
import { formatDate } from "@/lib/format";
import { getSession } from "@/lib/session";

/** Patients: the search bar plus this account's recently viewed patients. */
export default function PatientsPage() {
  return (
    <>
      <Suspense fallback={<PatientsTopBarFallback />}>
        <PatientsTopBar />
      </Suspense>
      <div className="box-border flex flex-col gap-[22px] px-8 pt-[26px] pb-9 max-sm:px-4">
        <Suspense fallback={<Card size="lg" className="h-[320px]" aria-busy="true">{null}</Card>}>
          <RecentlyViewed />
        </Suspense>
      </div>
    </>
  );
}

async function RecentlyViewed() {
  const session = await getSession();
  if (!session) redirect("/");
  const recent = await getRecentlyViewed(session.email, 8);

  return (
    <Card size="lg" as="section" aria-labelledby="recent-title" className="flex flex-col gap-1">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
        <h2 id="recent-title" className="m-0 text-[17px] font-bold">
          Recently viewed
        </h2>
        <span className="text-xs text-secondary">Patients you opened, newest first</span>
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border-t border-divider px-4 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-[15px] bg-primary-soft text-primary-ink">
            <SearchIcon size={20} strokeWidth={2} />
          </span>
          <span className="text-[15px] font-bold">Search by name or MRN to open a record</span>
          <span className="max-w-[360px] text-[13px] leading-normal text-secondary">
            Use the search bar above (⌘K). Patients you open will be listed here.
          </span>
        </div>
      ) : (
        <ul className="m-0 list-none p-0">
          {recent.map((p) => (
            <li key={p.id} className="border-t border-divider">
              <Link
                href={`/patients/${p.id}`}
                className="-mx-2 flex items-center gap-3.5 rounded-xl px-2 py-3 text-ink no-underline hover:bg-surface-muted"
              >
                <Avatar initials={p.initials} size={38} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{p.name}</span>
                  <span className="font-mono text-[11px] text-secondary">
                    DOB {formatDate(p.birthDate)} · MRN {p.mrn}
                  </span>
                </span>
                <span className="text-xs text-label">Viewed {p.viewedLabel}</span>
                <ArrowRightIcon className="text-label" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
