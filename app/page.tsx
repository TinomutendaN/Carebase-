// Placeholder home page. Becomes Sign in (role switcher) in Step 5.
export default function Home() {
  return (
    <>
      <div
        role="note"
        className="flex items-center justify-center gap-2 bg-banner/90 px-4 py-[7px] text-center text-xs font-medium text-banner-text"
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
        <span>Synthetic data only. Every patient in this demo is generated and fictional.</span>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-gradient-to-br from-primary to-primary-deep text-white shadow-[0_14px_34px_rgba(40,52,120,0.18)]">
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink">Carebase</h1>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-label">Setup complete · Step 1</p>
      </main>
    </>
  );
}
