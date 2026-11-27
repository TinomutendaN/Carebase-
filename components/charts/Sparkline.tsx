/**
 * Small trend line for wearable cards (heart rate, sleep, steps).
 * Works with any number of values: none draws nothing, one or a flat series
 * draws a level line. Higher values sit higher.
 */
export function Sparkline({ values, color, height = 40, label }: {
  values: number[];
  color: string;
  height?: number;
  /** Accessible summary; without it the sparkline is decorative. */
  label?: string;
}) {
  const W = 200;
  const PAD = 4; // keeps the 2.2px stroke inside the box
  const finite = values.filter(Number.isFinite);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const y = (v: number) => (max === min ? height / 2 : PAD + (1 - (v - min) / (max - min)) * (height - PAD * 2));

  const points =
    finite.length === 1
      ? `0,${height / 2} ${W},${height / 2}`
      : finite.map((v, i) => `${((i / (finite.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {finite.length > 0 && (
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
