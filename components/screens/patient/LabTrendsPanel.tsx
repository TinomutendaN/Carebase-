"use client";

import { useState, type ReactNode } from "react";
import { rangeStatus } from "@/components/charts/LabTrendChart";
import { ResponsiveLabTrendChart } from "@/components/charts/ResponsiveLabTrendChart";
import { IconChip } from "@/components/ui/IconChip";
import { LockIcon, PulseIcon } from "@/components/ui/icons";
import { Panel } from "@/components/ui/Panel";
import { Pill, PillGroup } from "@/components/ui/Pill";
import type { LabCode, LabSeries } from "@/lib/db/queries/labs";

const STATUS_WORDS = { in: "IN RANGE", above: "ABOVE RANGE", below: "BELOW RANGE" } as const;

type Props = {
  patientId: string;
  /** The switcher's labs, or null when this role can't see lab results (the locked box shows). */
  labs: LabCode[] | null;
  /** The first lab's results, rendered on the server. */
  initial: LabSeries | null;
  /** The wearables column. */
  children: ReactNode;
};

/**
 * "Lab trends and wearables": the dark teal panel on the Patient page. Switching
 * labs loads that lab once from /api/patients/{id}/labs, which checks the role again.
 */
export function LabTrendsPanel({ patientId, labs, initial, children }: Props) {
  const locked = labs === null;
  const [code, setCode] = useState(initial?.code ?? labs?.[0]?.code ?? "");
  const [cache, setCache] = useState<Record<string, LabSeries>>(initial ? { [initial.code]: initial } : {});
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function pick(next: string) {
    setCode(next);
    if (cache[next]) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    try {
      const response = await fetch(`/api/patients/${patientId}/labs?code=${encodeURIComponent(next)}`);
      if (!response.ok) throw new Error(String(response.status));
      const series = (await response.json()) as LabSeries;
      setCache((c) => ({ ...c, [next]: series }));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  const series = cache[code];
  const latest = series?.points.at(-1);
  const subtitle = locked
    ? "WEARABLES ONLY · LABS HIDDEN FOR FRONT DESK"
    : series && latest
      ? `LATEST ${series.name.toUpperCase()} ${latest.value} ${series.unit.toUpperCase()} · ${STATUS_WORDS[rangeStatus(latest.value, series.low, series.high)]}`
      : labs.length === 0
        ? "NO LAB RESULTS ON FILE"
        : "LOADING…";

  return (
    <Panel tone="teal" aria-labelledby="labs-title" className="flex flex-col gap-[18px] p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <IconChip color="teal" size={40}>
            <PulseIcon strokeWidth={2} />
          </IconChip>
          <div className="flex flex-col gap-0.5">
            <h2 id="labs-title" className="m-0 text-[17px] font-bold">
              Lab trends and wearables
            </h2>
            <span className="font-mono text-[11px] text-teal-muted">{subtitle}</span>
          </div>
        </div>
        {!locked && labs.length > 1 && (
          <PillGroup label="Lab test" tone="dark">
            {labs.map((lab) => (
              <Pill key={lab.code} tone="dark" pressed={lab.code === code} onClick={() => pick(lab.code)}>
                {lab.name}
              </Pill>
            ))}
          </PillGroup>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-0 flex-[2_1_440px] flex-col gap-2.5 rounded-[20px] border border-white/8 bg-[rgba(3,16,26,0.45)] px-[18px] py-4">
          {locked ? (
            <LockedLabs />
          ) : series && status !== "loading" ? (
            <ResponsiveLabTrendChart
              points={series.points}
              low={series.low}
              high={series.high}
              unit={series.unit}
              name={series.name}
              label={`${series.name.toUpperCase()} · LAST 5 YEARS`}
              rangeLabel={series.rangeLabel}
            />
          ) : (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-teal-muted" aria-live="polite">
              {status === "error"
                ? "Couldn't load this lab. Please try again."
                : labs.length === 0
                  ? "No lab results on file for this patient."
                  : "Loading lab results…"}
            </div>
          )}
        </div>
        {children}
      </div>
    </Panel>
  );
}

function LockedLabs() {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-[rgba(94,234,212,0.3)] bg-[rgba(45,212,191,0.04)] p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-[15px] bg-teal/12 text-mint">
        <LockIcon size={20} strokeWidth={2} />
      </span>
      <span className="text-[15px] font-bold">Lab results are hidden for Front Desk</span>
      <span className="max-w-[340px] text-[13px] leading-normal text-teal-muted">
        Clinicians and Admins can see this patient&apos;s lab trends.
      </span>
    </div>
  );
}
