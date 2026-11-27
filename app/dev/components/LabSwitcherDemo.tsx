"use client";

import { useState } from "react";
import { LabTrendChart, type LabPoint } from "@/components/charts/LabTrendChart";
import { Pill, PillGroup } from "@/components/ui/Pill";

export type DemoLab = {
  key: string;
  short: string;
  name: string;
  unit: string;
  low: number | null;
  high: number | null;
  rangeLabel: string;
  points: LabPoint[];
};

/** Preview only: the dark HbA1c / Glucose / LDL switcher driving the lab chart. */
export function LabSwitcherDemo({ labs, period }: { labs: DemoLab[]; period: string }) {
  const [key, setKey] = useState(labs[0].key);
  const lab = labs.find((l) => l.key === key) ?? labs[0];
  return (
    <div className="flex flex-col gap-4">
      <PillGroup label="Lab test" tone="dark" className="self-start">
        {labs.map((l) => (
          <Pill key={l.key} tone="dark" pressed={l.key === key} onClick={() => setKey(l.key)}>
            {l.short}
          </Pill>
        ))}
      </PillGroup>
      <div className="rounded-[20px] border border-white/8 bg-[rgba(3,16,26,0.45)] px-5 py-[18px]">
        <LabTrendChart
          points={lab.points}
          low={lab.low}
          high={lab.high}
          unit={lab.unit}
          name={lab.name}
          label={`${lab.short.toUpperCase()} · ${period}`}
          rangeLabel={lab.rangeLabel}
        />
      </div>
    </div>
  );
}
