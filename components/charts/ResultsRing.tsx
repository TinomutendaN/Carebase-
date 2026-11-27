/** The glowing test results ring (Tests page): share of tests passing. */
export function ResultsRing({ passed, total, size = 168 }: { passed: number; total: number; size?: number }) {
  const R = 50;
  const C = 2 * Math.PI * R;
  const share = total > 0 ? Math.min(Math.max(passed / total, 0), 1) : 0;
  const pct = Math.round(share * 100);

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg role="img" aria-label={`${passed} of ${total} tests passing`} viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={11} />
        {share > 0 && (
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="#2DD4BF"
            strokeWidth={11}
            strokeLinecap="round"
            strokeDasharray={`${(share * C).toFixed(1)} ${C.toFixed(1)}`}
            transform="rotate(-90 60 60)"
            style={{ filter: "drop-shadow(0 0 6px rgba(45,212,191,0.7))" }}
          />
        )}
      </svg>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="leading-none font-extrabold" style={{ fontSize: Math.round(size * 0.2) }}>
          {pct}%
        </span>
        <span className="text-lavender" style={{ fontSize: Math.max(10, Math.round(size * 0.07)) }}>
          passing
        </span>
      </div>
    </div>
  );
}
