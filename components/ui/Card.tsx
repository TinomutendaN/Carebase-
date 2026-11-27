import type { ElementType, ReactNode } from "react";
import { cx } from "@/lib/cx";

type CardProps = {
  /** md: number cards (20px radius, 20px padding). lg: list sections (24px radius). */
  size?: "md" | "lg";
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>;

/** Light surface: white gradient, hairline border, long faint shadow. */
export function Card({ size = "md", as: Tag = "div", className, children, ...rest }: CardProps) {
  return (
    <Tag
      className={cx(
        "border border-hairline/90 bg-linear-to-b from-surface to-surface-soft text-ink shadow-card",
        size === "md" ? "rounded-[20px] p-5" : "rounded-3xl px-6 py-[22px]",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
