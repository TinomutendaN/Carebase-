/**
 * Pure helpers for the hand-built SVG charts: scales, "nice" value ticks and
 * date ticks. Dates are "YYYY-MM-DD" strings, read and formatted in UTC so the
 * server and browser always agree.
 */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAY_MS = 86_400_000;

export function toTime(date: string): number {
  return Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
}

/** "12 NOV 2026" */
export function formatDay(date: string): string {
  const d = new Date(toTime(date));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Maps a domain [d0, d1] onto a range [r0, r1]. A zero-width domain maps to the middle. */
export function linearScale(d0: number, d1: number, r0: number, r1: number) {
  return (v: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
}

/** A step of 1, 2, 2.5 or 5 × 10^k that splits the span into about `count` parts. */
function niceStep(span: number, count: number): number {
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * A rounded value domain that holds every value given, with ticks along it.
 * Used for the lab chart's y axis (about 4 intervals, like the designs).
 */
export function niceDomain(
  values: number[],
  count = 4,
  /** Pad below the lowest value. Off when that value is a range bound, not a data point. */
  padBottom = true,
): { min: number; max: number; ticks: number[]; decimals: number } {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0;
    hi = 1;
  }
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }
  // Breathing room so points never sit on the frame.
  const pad = (hi - lo) * 0.08;
  const bottomPad = padBottom ? pad : 0;
  const step = niceStep(hi - lo + pad + bottomPad, count);
  const min = Math.max(lo >= 0 ? 0 : -Infinity, Math.floor((lo - bottomPad) / step) * step);
  const max = Math.ceil((hi + pad) / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return { min, max, ticks, decimals };
}

export type DateTick = { time: number; label: string };

/**
 * Date ticks for a time span, at most `maxTicks` of them: months for short
 * spans ("JUN"), quarters with a year for medium ones ("JAN 25"), years for long ones ("2024").
 */
export function dateTicks(start: number, end: number, maxTicks = 6): DateTick[] {
  const first = new Date(start);
  const months = (new Date(end).getUTCFullYear() - first.getUTCFullYear()) * 12 + new Date(end).getUTCMonth() - first.getUTCMonth();
  const step = [1, 2, 3, 6, 12, 24].find((s) => months / s <= maxTicks - 1) ?? Math.ceil(months / (maxTicks - 1) / 12) * 12;

  const crossesYear = first.getUTCFullYear() !== new Date(end).getUTCFullYear();
  // Start on the first month boundary at or after `start` that lines up with the step.
  let year = first.getUTCFullYear();
  let month = first.getUTCMonth() + (first.getUTCDate() === 1 ? 0 : 1);
  if (step >= 12) {
    year += month > 0 ? 1 : 0;
    month = 0;
  } else {
    month = Math.ceil(month / step) * step;
  }

  const ticks: DateTick[] = [];
  for (let guard = 0; guard < 200; guard++) {
    const time = Date.UTC(year, month, 1);
    if (time > end) break;
    const d = new Date(time);
    const label =
      step >= 12
        ? String(d.getUTCFullYear())
        : crossesYear && step > 1
          ? `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`
          : MONTHS[d.getUTCMonth()];
    ticks.push({ time, label });
    month += step;
  }
  return ticks;
}

/** Pads a zero-length time span so a single result still gets an axis. */
export function timeDomain(times: number[]): [number, number] {
  const start = Math.min(...times);
  const end = Math.max(...times);
  return start === end ? [start - 15 * DAY_MS, end + 15 * DAY_MS] : [start, end];
}

/** Formats a value with a fixed number of decimals, dropping a trailing ".0". */
export function formatValue(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}
