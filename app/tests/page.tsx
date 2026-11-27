import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { IconChip } from "@/components/ui/IconChip";
import { GlobeIcon, LogoIcon } from "@/components/ui/icons";

// Placeholder: the public Tests page. Results arrive in Step 9. No sidebar, no sign-in.
export default function TestsPage() {
  return (
    <>
      <Banner />
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline/80 bg-white/72 px-10 py-4 backdrop-blur-[14px]">
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
    </>
  );
}
