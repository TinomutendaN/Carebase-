import Link from "next/link";
import type { ReactNode } from "react";
import { IconChip, type ChipColor } from "@/components/ui/IconChip";
import { MoreIcon } from "@/components/ui/icons";

export type StatCard = {
  key: string;
  icon: ReactNode;
  color: Extract<ChipColor, "blue" | "green" | "amber" | "purple">;
  value: string;
  label: string;
  /** Footer detail, e.g. "1 overdue". */
  meta: string;
  /** "Open Tasks" */
  link: string;
  href: string;
};

/** The four number cards at the top of the Dashboard (designs/02-dashboard-*.png). Each opens the screen it counts. */
export function StatCards({ cards }: { cards: StatCard[] }) {
  return (
    <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-[18px]">
      {cards.map((c) => (
        <Link
          key={c.key}
          href={c.href}
          className="flex flex-col gap-3.5 rounded-[20px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft p-5 text-ink no-underline shadow-card transition-shadow hover:shadow-[0_1px_2px_rgba(40,52,120,0.05),0_18px_40px_rgba(40,52,120,0.13)]"
        >
          <div className="flex items-start justify-between">
            <IconChip color={c.color}>{c.icon}</IconChip>
            <MoreIcon className="text-[#8A91A6]" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em]">{c.value}</span>
            <span className="text-sm text-secondary">{c.label}</span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-divider pt-3 text-xs">
            <span className="text-secondary">{c.meta}</span>
            <span className="font-semibold whitespace-nowrap text-primary-ink">{c.link} →</span>
          </div>
        </Link>
      ))}
    </section>
  );
}
