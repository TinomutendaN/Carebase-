import { Suspense } from "react";
import { TestList } from "@/components/screens/tests/TestList";
import { TestsSummary } from "@/components/screens/tests/TestsSummary";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { IconChip } from "@/components/ui/IconChip";
import { GlobeIcon, LogoIcon } from "@/components/ui/icons";
import { getRun, runChoice } from "@/lib/db/queries/tests";

/**
 * The public Tests page (designs/07-tests.png): the latest run of the test suite
 * against the live site, as it is. ?run=latest-local shows the latest local run, ?run=12 run 12.
 * No sidebar, no sign-in.
 */
export default function TestsPage({ searchParams }: PageProps<"/tests">) {
  return (
    <>
      <Banner />
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline/80 bg-white/72 px-10 py-4 backdrop-blur-[14px] max-sm:px-4">
        <div className="flex items-center gap-3.5">
          <IconChip color="primary" size={40}>
            <LogoIcon />
          </IconChip>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold tracking-[0.1em] text-label">
              CAREBASE <span aria-hidden="true">›</span> <span className="text-primary-ink">TESTS</span>
            </span>
            <h1 className="m-0 text-xl font-bold">Assistant test results</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-xl border border-field-border bg-surface px-3.5 py-2 text-[13px] font-semibold text-nav-text">
            <GlobeIcon className="text-[#15803D]" />
            Public page · no sign-in needed
          </span>
          <Button href="/" size="bar">
            Sign in to the demo
          </Button>
        </div>
      </header>
      <main className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-[22px] px-10 pt-7 pb-11 max-sm:px-4">
        <Suspense fallback={<TestsSkeleton />}>
          <TestResults searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function TestResults({ searchParams }: { searchParams: PageProps<"/tests">["searchParams"] }) {
  const choice = runChoice((await searchParams).run);
  const run = await getRun(choice);

  if (!run) {
    const title =
      choice.kind === "live" ? "The tests haven't been run against the live site yet"
      : choice.kind === "latest-local" ? "No local test run yet"
      : `There's no test run ${choice.id}`;
    return (
      <section className="mx-auto flex max-w-[520px] flex-col items-center gap-2 rounded-[22px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft p-8 text-center shadow-card">
        <h2 className="m-0 text-base font-bold">{title}</h2>
        <p className="m-0 text-sm leading-relaxed text-secondary">
          Results appear here after <code className="font-mono text-[13px]">npm run test:assistant</code> runs every test against the site.
        </p>
      </section>
    );
  }

  return (
    <>
      <TestsSummary run={run} />
      <TestList results={run.results} />
    </>
  );
}

function TestsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading test results" className="flex flex-col gap-[22px]">
      <div className="h-[230px] animate-pulse rounded-[28px] bg-[#25216A]/80" />
      <div className="h-[520px] animate-pulse rounded-3xl bg-white/70" />
    </div>
  );
}
