import { useId } from "react";
import { cx } from "@/lib/cx";
import { dateTicks, formatDay, formatValue, linearScale, niceDomain, timeDomain, toTime } from "@/components/charts/chart-utils";

/**
 * Lab trend chart for dark teal panels (Dashboard spotlight, Patient page).
 * Handles any number of results: the x axis is by date, so irregular gaps
 * over years space correctly. The normal range is a shaded band; each dot is
 * coloured in range (teal), above (amber) or below (red); a card marks the latest value.
 */

export type LabPoint = { date: string; value: number; id?: string };
export type RangeStatus = "in" | "above" | "below";

// Plot area inside the 640 × 260 viewBox (from designs/source/02-dashboard.html).
const W = 640;
const H = 260;
const LEFT = 48;
const RIGHT = 616;
const TOP = 20;
const BOTTOM = 220;
const AXIS_Y = 248;

const DOT_COLOR: Record<RangeStatus, string> = { in: "#2DD4BF", above: "#FBBF24", below: "#F87171" };
const STATUS_TEXT: Record<RangeStatus, { label: string; className: string; border: string }> = {
  in: { label: "IN RANGE", className: "text-mint", border: "border-teal/45" },
  above: { label: "ABOVE RANGE", className: "text-amber-soft", border: "border-amber/45" },
  below: { label: "BELOW RANGE", className: "text-[#FCA5A5]", border: "border-red-soft/45" },
};

export function rangeStatus(value: number, low?: number | null, high?: number | null): RangeStatus {
  if (high != null && value > high) return "above";
  if (low != null && value < low) return "below";
  return "in";
}

type Props = {
  points: LabPoint[];
  /** Normal range; either end may be missing (e.g. LDL has only an upper target). */
  low?: number | null;
  high?: number | null;
  unit: string;
  /** Full test name for the latest-value card, e.g. "HbA1c". */
  name: string;
  /** Small mono heading above the chart, e.g. "HBA1C · LAST 5 YEARS". */
  label?: string;
  /** Right-hand caption, e.g. "Normal range 4.0–5.6%". */
  rangeLabel?: string;
  className?: string;
};

export function LabTrendChart({ points, low, high, unit, name, label, rangeLabel, className }: Props) {
  const gradientId = `lab-area-${useId().replace(/:/g, "")}`;
  const sorted = [...points].sort((a, b) => toTime(a.date) - toTime(b.date));

  const header = (label || rangeLabel) && (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      {label && <span className="font-mono text-[11px] tracking-[0.14em] text-mint-label">{label}</span>}
      {rangeLabel && <span className="text-xs text-teal-muted">{rangeLabel}</span>}
    </div>
  );

  if (sorted.length === 0) {
    return (
      <div className={cx("flex flex-col gap-3", className)}>
        {header}
        <div className="flex aspect-640/260 items-center justify-center rounded-2xl border border-dashed border-white/12 text-sm text-teal-muted">
          No {name} results yet
        </div>
      </div>
    );
  }

  // Scales.
  const values = sorted.map((p) => p.value);
  const bounds = [low, high].filter((v): v is number => v != null);
  // No bottom padding when the lowest thing on the chart is the range's lower bound.
  const y = niceDomain([...values, ...bounds], 4, Math.min(...values) <= Math.min(...values, ...bounds));
  const [t0, t1] = timeDomain(sorted.map((p) => toTime(p.date)));
  const X = linearScale(t0, t1, LEFT, RIGHT);
  const Y = linearScale(y.min, y.max, BOTTOM, TOP);

  // Dots get smaller as results pile up, so 5 years stays readable.
  const n = sorted.length;
  const dotR = n <= 12 ? 5 : n <= 30 ? 3.5 : 2.5;
  const ringW = n <= 30 ? 3 : 2;

  const dots = sorted.map((p, i) => {
    const status = rangeStatus(p.value, low, high);
    const last = i === n - 1;
    return { ...p, x: X(toTime(p.date)), y: Y(p.value), status, r: last ? Math.max(dotR + 2, 5) : dotR, last };
  });
  const line = dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(" ");
  const area = `${line} ${dots[n - 1].x.toFixed(1)},${BOTTOM} ${dots[0].x.toFixed(1)},${BOTTOM}`;

  // Normal range band, clamped to the plot.
  const bandTop = Y(Math.min(high ?? y.max, y.max));
  const bandBottom = Y(Math.max(low ?? y.min, y.min));
  const showBand = (low != null || high != null) && bandBottom > bandTop;

  // X labels: one under each point when there are few (as in the designs), else date ticks.
  const monthLabels = dots.map((d) => formatDay(d.date).split(" ")[1]);
  const perPoint = n <= 8 && new Set(monthLabels).size === n;
  const xLabels = perPoint
    ? dots.map((d, i) => ({ x: d.x, label: monthLabels[i] }))
    : dateTicks(t0, t1).map((t) => ({ x: X(t.time), label: t.label }));

  const latest = dots[n - 1];
  const status = STATUS_TEXT[latest.status];
  const first = sorted[0];
  const aria =
    `${name}, ${n} ${n === 1 ? "result" : "results"}` +
    (n > 1 ? ` from ${formatDay(first.date)} to ${formatDay(latest.date)}` : ` on ${formatDay(latest.date)}`) +
    `, latest ${latest.value} ${unit}, ${status.label.toLowerCase()}`;

  // The latest card sits left of the last point (as in the designs); near the left edge it flips right.
  // With many results it would cover the recent dots, so it drops below or above the line instead.
  const flip = latest.x < 260;
  const dense = n > 8;
  const below = dense && latest.y < (TOP + BOTTOM) / 2;
  const topPct = dense ? (latest.y / H) * 100 : Math.min(Math.max((latest.y / H) * 100, 22), 78);
  const cardTransform = dense
    ? `translate(calc(-100% + 8px), ${below ? "22px" : "calc(-100% - 22px)"})`
    : flip
      ? "translate(18px, -50%)"
      : "translate(calc(-100% - 18px), -50%)";

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      {header}
      <div className="relative aspect-640/260 w-full">
        <svg role="img" aria-label={aria} viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" className="overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FBBF24" stopOpacity="0.28" />
              <stop offset="1" stopColor="#FBBF24" stopOpacity="0" />
            </linearGradient>
          </defs>

          {y.ticks.map((v) => (
            <g key={v}>
              <line x1={LEFT} x2={RIGHT} y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,0.07)" />
              <text x={36} y={Y(v) + 4} textAnchor="end" fill="#7E9AA6" fontSize="11" className="font-mono">
                {formatValue(v, y.decimals)}
              </text>
            </g>
          ))}

          {showBand && (
            <>
              <rect
                x={LEFT}
                y={bandTop}
                width={RIGHT - LEFT}
                height={Math.max(bandBottom - bandTop, 2)}
                fill="rgba(45,212,191,0.13)"
                stroke="rgba(45,212,191,0.45)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
              <text
                x={RIGHT - 6}
                y={bandBottom - bandTop >= 22 ? bandTop + 15 : bandTop - 6}
                textAnchor="end"
                fill="#5EEAD4"
                fontSize="11"
                className="font-mono"
              >
                NORMAL RANGE
              </text>
            </>
          )}

          {n > 1 && (
            <>
              <polygon points={area} fill={`url(#${gradientId})`} />
              <polyline points={line} fill="none" stroke="#FBBF24" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {dots.map((d, i) => (
            <circle
              key={d.id ?? `${d.date}-${i}`}
              data-lab-id={d.id}
              cx={d.x}
              cy={d.y}
              r={d.r}
              fill="#0A1C2B"
              stroke={DOT_COLOR[d.status]}
              strokeWidth={d.last ? 3 : ringW}
            >
              <title>{`${formatDay(d.date)}: ${d.value} ${unit}`}</title>
            </circle>
          ))}

          {xLabels.map((t, i) => (
            <text key={`${t.label}-${i}`} x={t.x} y={AXIS_Y} textAnchor="middle" fill="#7E9AA6" fontSize="11" className="font-mono">
              {t.label}
            </text>
          ))}
        </svg>

        <div
          aria-hidden="true"
          className={cx(
            "absolute flex min-w-[160px] flex-col gap-1 rounded-[14px] border bg-[rgba(12,20,30,0.92)] px-[13px] py-[11px] shadow-[0_10px_30px_rgba(0,0,0,0.4)]",
            status.border,
          )}
          style={{
            left: `${(latest.x / W) * 100}%`,
            top: `${topPct}%`,
            transform: cardTransform,
          }}
        >
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-[13px] font-bold">{name}</span>
            <span
              className="size-2 rounded-full"
              style={{ background: DOT_COLOR[latest.status], boxShadow: `0 0 10px ${DOT_COLOR[latest.status]}` }}
            />
          </div>
          <span className={cx("text-[11px] font-bold tracking-[0.08em]", status.className)}>{status.label}</span>
          <div className="mt-0.5 flex items-baseline justify-between gap-2.5 border-t border-white/10 pt-1.5">
            <span className="font-mono text-[10px] whitespace-nowrap text-chart-text">{formatDay(latest.date)}</span>
            <span className="font-mono text-sm font-bold whitespace-nowrap">
              {latest.value} {unit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The In range / Above range / Below range key under the chart. */
export function LabLegend({ note }: { note?: string }) {
  const items: [RangeStatus, string][] = [
    ["in", "In range"],
    ["above", "Above range"],
    ["below", "Below range"],
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-[18px] text-xs text-[#C9D8DE]">
      {items.map(([key, text]) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: DOT_COLOR[key] }} />
          {text}
        </span>
      ))}
      {note && <span className="font-mono text-chart-text">{note}</span>}
    </div>
  );
}
