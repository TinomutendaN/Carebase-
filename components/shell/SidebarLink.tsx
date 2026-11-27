"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** A sidebar item. Highlights itself when the URL is its page or below it. */
export function SidebarLink({ href, active: forced, children }: {
  href: string;
  /** Overrides the URL match (used by the /dev/components preview). */
  active?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = forced ?? (pathname === href || pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex min-h-[42px] items-center gap-3 rounded-[10px] border px-3 text-sm no-underline transition-colors",
        active
          ? "border-primary-line bg-primary-soft font-semibold text-primary-ink"
          : "border-transparent font-medium text-nav-text hover:bg-primary-soft/60",
      )}
    >
      {children}
    </Link>
  );
}
