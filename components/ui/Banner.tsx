import { InfoIcon } from "@/components/ui/icons";

/** The "synthetic data only" banner shown at the top of every page. */
export function Banner() {
  return (
    <div
      role="note"
      className="flex items-center justify-center gap-2 bg-banner/90 px-4 py-[7px] text-center text-xs font-medium text-banner-text"
    >
      <InfoIcon />
      <span>Synthetic data only. Every patient in this demo is generated and fictional.</span>
    </div>
  );
}
