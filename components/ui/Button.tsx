import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

const VARIANTS = {
  // "Approve", "Sign in to the demo", "View all".
  primary: "bg-linear-145 from-primary to-[#2F55E0] text-white font-bold shadow-button",
  // "Reject".
  secondary: "border border-field-border bg-surface text-nav-text font-semibold hover:bg-surface-soft",
  // "Export de-identified data".
  teal: "bg-linear-145 from-teal to-[#14B8A6] text-teal-on font-bold shadow-[0_0_26px_rgba(45,212,191,0.45)]",
  // "Open Record" on dark panels.
  "ghost-dark": "border border-white/14 bg-white/6 text-white font-semibold hover:bg-white/10",
} as const;

const SIZES = {
  md: "min-h-[42px] px-4 text-[13px]",
  // Top bar actions, e.g. "Sign in to the demo".
  bar: "min-h-11 px-[18px] text-sm",
  lg: "h-12 px-[18px] text-sm",
} as const;

const DISABLED = "bg-[#E8EBF3] text-[#8A91A6] font-bold cursor-not-allowed";

type Common = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Fully round ends, like "View all" on the urgent tasks panel. */
  round?: boolean;
  /** Icon shown after the label. */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = Common & { href: string; disabled?: never };

function classesFor({ variant = "primary", size = "md", round, className }: Common, disabled?: boolean) {
  return cx(
    "inline-flex cursor-pointer items-center justify-center gap-2 no-underline transition-colors",
    SIZES[size],
    round ? "rounded-full" : size === "lg" ? "rounded-[13px]" : "rounded-xl",
    // A disabled button drops its variant colours entirely, so nothing conflicts.
    disabled ? DISABLED : VARIANTS[variant],
    className,
  );
}

export function Button(props: ButtonProps | LinkProps) {
  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={classesFor(props)}>
        {props.children}
        {props.icon}
      </Link>
    );
  }

  const { variant, size, round, icon, className, children, disabled, onClick, ...native } = props;
  return (
    <button
      type="button"
      {...native}
      // aria-disabled keeps the button focusable, so keyboard users can reach it and read why.
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={classesFor({ variant, size, round, className, children }, disabled)}
    >
      {children}
      {icon}
    </button>
  );
}
