import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const COLORS = {
  // Soft chips on light number cards.
  blue: "bg-[#EAF0FF] text-badge-blue shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]",
  green: "bg-[#E3F6EC] text-[#15803D] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]",
  amber: "bg-[#FFF1D6] text-[#B45309] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]",
  purple: "bg-[#F0EAFE] text-[#6D4AE8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]",
  // Glowing chip on dark panel headers.
  teal: "bg-linear-145 from-teal to-teal-deep text-white shadow-glow-teal",
  // Logo tile and primary accents.
  primary: "bg-linear-145 from-primary to-primary-deep text-white shadow-logo",
  // Assistant accent.
  ai: "bg-linear-145 from-ai to-ai-deep text-white shadow-[0_0_22px_rgba(139,123,255,0.45)]",
} as const;

export type ChipColor = keyof typeof COLORS;

/** Rounded-square icon holder (about 40px, icon at 18px). */
export function IconChip({ color, size = 42, className, children }: {
  color: ChipColor;
  size?: 40 | 42 | 44;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "flex flex-none items-center justify-center",
        size === 40 ? "size-10 rounded-xl" : size === 42 ? "size-[42px] rounded-[13px]" : "size-11 rounded-[13px]",
        COLORS[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
