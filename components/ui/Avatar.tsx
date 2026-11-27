import { cx } from "@/lib/cx";

/** Gradients used for initials avatars in the designs (05-tasks, 06-admin). */
export const AVATAR_GRADIENTS = [
  "linear-gradient(145deg, #7C6CFF, #3F51D8)",
  "linear-gradient(145deg, #F59E0B, #D97706)",
  "linear-gradient(145deg, #38BDF8, #0284C7)",
  "linear-gradient(145deg, #F472B6, #DB2777)",
  "linear-gradient(145deg, #34D399, #059669)",
  "linear-gradient(145deg, #A78BFA, #7C3AED)",
  "linear-gradient(145deg, #FB923C, #EA580C)",
  "linear-gradient(145deg, #2DD4BF, #0E9F8E)",
] as const;

/** The signed-in account's blue gradient (sidebar and top bar). */
export const ACCOUNT_GRADIENT = "linear-gradient(145deg, #4C72F0, #2847C4)";

/** Same initials always get the same gradient. */
export function gradientFor(initials: string): string {
  let hash = 0;
  for (const ch of initials) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

/** People appear only as initials in gradient circles or rounded squares. */
export function Avatar({ initials, size = 38, shape = "circle", gradient, online, className }: {
  initials: string;
  size?: number;
  shape?: "circle" | "square";
  /** CSS background; defaults to a gradient picked from the initials. */
  gradient?: string;
  /** Green presence dot, as on the sidebar account card. */
  online?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative flex flex-none items-center justify-center font-bold text-white select-none",
        shape === "circle" ? "rounded-full" : "rounded-xl",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34), background: gradient ?? gradientFor(initials) }}
    >
      {initials}
      {online && (
        <span className="absolute -right-px -bottom-px size-2.5 rounded-full border-2 border-white bg-green" />
      )}
    </span>
  );
}
