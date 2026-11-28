import { ResultsRing } from "@/components/charts/ResultsRing";
import { clinicTimeZone } from "@/lib/clinic-date";
import { TEST_CATEGORIES, type TestRun } from "@/lib/test-runs";
import { CATEGORY_META } from "./categories";

const MONO_CHIP = "rounded-lg px-2.5 py-[5px] font-mono text-[11px]";

/** "28 NOV · 09:14", in the clinic's time zone. */
function lastRunLabel(iso: string): string {
  const zone = clinicTimeZone();
  const at = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "numeric", month: "short" }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  return `${day} · ${time}`.toUpperCase();
}

/** The indigo summary panel: results ring, pass count, run details and a bar per category (designs/07-tests.png). */
export function TestsSummary({ run }: { run: TestRun }) {
  const failing = run.total - run.passed;
  return (
    <section
      aria-labelledby="sum-title"
      className="on-dark flex flex-wrap items-center gap-7 rounded-[28px] border border-white/8 bg-[radial-gradient(520px_300px_at_18%_50%,rgba(45,212,191,0.22),transparent_70%),radial-gradient(620px_320px_at_100%_0%,rgba(124,92,255,0.4),transparent_70%),linear-gradient(160deg,#25216A,#15163F)] p-7 text-white shadow-[0_28px_70px_rgba(30,26,90,0.35)] max-sm:p-5"
    >
      <div className="flex flex-[1_1_360px] items-center gap-[26px] max-sm:flex-col max-sm:items-start">
        <ResultsRing passed={run.passed} total={run.total} />
        <div className="flex flex-col gap-2.5">
          <h2 id="sum-title" className="m-0 text-[26px] font-extrabold tracking-[-0.01em]">
            {run.passed} of {run.total} tests pass
          </h2>
          <p className="m-0 max-w-[340px] text-sm leading-[1.6] text-[#D6D5F2]">
            Every test asks the assistant a question, or tries an action, and checks the result against what should happen.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className={`${MONO_CHIP} bg-white/8 text-[#D6D5F2]`}>LAST RUN {lastRunLabel(run.ranAt)}</span>
            {failing > 0 && <span className={`${MONO_CHIP} bg-[rgba(248,113,113,0.16)] font-semibold text-[#FDA4AF]`}>{failing} FAILING</span>}
            {run.model && <span className={`${MONO_CHIP} bg-white/8 text-[#D6D5F2]`}>MODEL {run.model.toUpperCase()}</span>}
            <span className={`${MONO_CHIP} bg-white/8 text-[#D6D5F2]`}>{run.live ? "LIVE SITE" : "LOCAL RUN"}</span>
          </div>
        </div>
      </div>
      <CategoryBars run={run} />
    </section>
  );
}

function CategoryBars({ run }: { run: TestRun }) {
  return (
    <div className="flex flex-[1_1_380px] flex-col gap-3.5 rounded-[20px] border border-white/8 bg-[rgba(10,10,40,0.35)] p-5">
      <span className="font-mono text-[11px] tracking-[0.14em] text-[#A5B4FC]">BY CATEGORY</span>
      {TEST_CATEGORIES.map((category) => {
        const rows = run.results.filter((r) => r.category === category);
        const pass = rows.filter((r) => r.passed).length;
        const ok = pass === rows.length;
        const pct = rows.length ? Math.round((pass / rows.length) * 100) : 0;
        return (
          <div key={category} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-2.5 text-[13px]">
              <span className="font-semibold">{CATEGORY_META[category].label}</span>
              <span className={`font-mono text-xs ${ok ? "text-[#99F6E4]" : "text-[#FCD34D]"}`}>
                {pass} / {rows.length}
              </span>
            </div>
            <div
              role="meter"
              aria-label={`${CATEGORY_META[category].label}: ${pass} of ${rows.length} passing`}
              aria-valuemin={0}
              aria-valuemax={rows.length}
              aria-valuenow={pass}
              className="h-2 overflow-hidden rounded-full bg-white/8"
            >
              <div
                className={
                  ok
                    ? "h-full rounded-full bg-linear-90 from-[#14B8A6] to-[#2DD4BF] shadow-[0_0_10px_rgba(45,212,191,0.5)]"
                    : "h-full rounded-full bg-linear-90 from-[#F59E0B] to-[#FBBF24] shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                }
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
