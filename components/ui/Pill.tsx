import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

type Tone = "light" | "dark";

/**
 * Segmented toggle group. light: filter tabs on Tasks, Admin and Tests.
 * dark: the HbA1c / Glucose / LDL switcher on teal panels.
 */
export function PillGroup({ label, tone = "light", className, children }: {
  label: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        "flex flex-wrap gap-1 p-1",
        tone === "light" ? "rounded-[13px] border border-[#E3E7F2] bg-tab-track" : "rounded-[14px] border border-white/8 bg-white/5",
        className,
      )}
    >
      {children}
    </div>
  );
}

type PillProps = {
  pressed: boolean;
  tone?: Tone;
  /** Shown faded after the label, e.g. a tab's count. */
  count?: number | string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed">;

export function Pill({ pressed, tone = "light", count, className, children, ...rest }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cx(
        "cursor-pointer font-semibold transition-colors",
        tone === "light"
          ? cx("min-h-[34px] rounded-[9px] px-3 text-[13px]", pressed ? "bg-surface text-primary-ink shadow-tab" : "text-secondary hover:text-ink")
          : cx(
              "min-h-9 rounded-[10px] px-4 text-[13px]",
              pressed
                ? "bg-linear-145 from-teal to-teal-deep text-teal-on shadow-[0_0_18px_rgba(45,212,191,0.45)]"
                : "text-[#C9D8DE] hover:text-white",
            ),
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined && <span className="opacity-70"> {count}</span>}
    </button>
  );
}
