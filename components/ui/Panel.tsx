import type { ElementType, ReactNode } from "react";
import { cx } from "@/lib/cx";

const TONES = {
  // Patient spotlight, patient lab card.
  teal:
    "rounded-[26px] border-mint/15 shadow-panel-teal " +
    "bg-[radial-gradient(560px_300px_at_50%_30%,rgba(45,212,191,0.16),transparent_70%),radial-gradient(420px_220px_at_100%_0%,rgba(56,189,248,0.14),transparent_70%),linear-gradient(165deg,#0F3142,#0A1C2B)]",
  // Most urgent tasks, Tests summary.
  indigo:
    "rounded-3xl border-white/8 shadow-panel-indigo " +
    "bg-[radial-gradient(520px_220px_at_12%_-10%,rgba(45,212,191,0.22),transparent_70%),radial-gradient(620px_260px_at_100%_0%,rgba(124,92,255,0.38),transparent_70%),linear-gradient(160deg,#25216A,#15163F)]",
} as const;

type PanelProps = {
  tone: keyof typeof TONES;
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>;

/** Dark feature panel with soft inner glows. Children use the lighter focus ring (.on-dark). */
export function Panel({ tone, as: Tag = "section", className, children, ...rest }: PanelProps) {
  return (
    <Tag className={cx("on-dark border p-6 text-white", TONES[tone], className)} {...rest}>
      {children}
    </Tag>
  );
}
