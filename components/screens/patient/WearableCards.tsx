import { Sparkline } from "@/components/charts/Sparkline";
import type { WearableKind, WearableSeries } from "@/lib/db/queries/patients";
import { formatCount, formatHours } from "@/lib/format";

const CARDS: { kind: WearableKind; label: string; unit: string; color: string; format: (v: number) => string }[] = [
  { kind: "heart_rate", label: "HEART RATE", unit: "bpm avg", color: "#F87171", format: (v) => String(Math.round(v)) },
  { kind: "sleep_hours", label: "SLEEP", unit: "per night", color: "#A78BFA", format: formatHours },
  { kind: "steps", label: "STEPS", unit: "per day", color: "#2DD4BF", format: formatCount },
];

/** Heart rate, sleep and steps: 14-day averages with a sparkline of the daily values. */
export function WearableCards({ wearables }: { wearables: Record<WearableKind, WearableSeries> }) {
  return (
    <div id="wearables" className="flex min-w-0 flex-[1_1_220px] flex-col gap-2.5">
      <span className="font-mono text-[11px] tracking-[0.14em] text-mint-label">WEARABLES · 14 DAYS</span>
      {CARDS.map((card) => {
        const series = wearables[card.kind];
        const value = series.average == null ? "—" : card.format(series.average);
        return (
          <div
            key={card.kind}
            className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-linear-to-b from-white/7 to-white/2 px-3.5 py-3"
          >
            <span className="text-[11px] font-bold tracking-[0.1em] text-teal-muted">{card.label}</span>
            <span className="text-xl font-extrabold">
              {value}{" "}
              <span className="text-xs font-medium text-teal-muted">{series.average == null ? "no readings" : card.unit}</span>
            </span>
            <Sparkline
              values={series.values}
              color={card.color}
              height={34}
              label={series.values.length ? `${card.label.toLowerCase()}, last ${series.values.length} days` : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
