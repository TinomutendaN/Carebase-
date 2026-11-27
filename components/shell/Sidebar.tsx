import Link from "next/link";
import type { ComponentType } from "react";
import { can, ROLE_LABELS, type Area, type Role } from "@/lib/access";
import { cx } from "@/lib/cx";
import { ACCOUNT_GRADIENT, Avatar } from "@/components/ui/Avatar";
import { IconChip } from "@/components/ui/IconChip";
import {
  AdminIcon,
  DashboardIcon,
  IntakeIcon,
  LogoIcon,
  PatientsIcon,
  SwitchRoleIcon,
  TasksIcon,
  TestsIcon,
  type IconProps,
} from "@/components/ui/icons";
import { SidebarLink } from "@/components/shell/SidebarLink";

export type SidebarCounts = { intake?: number; tasks?: number };

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
  /** The access area that decides who sees this item. No area: everyone. */
  area?: Area;
  badge?: { count: keyof SidebarCounts; className: string; srLabel: string };
};

const NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: "CLINICAL",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
      { href: "/patients", label: "Patients", icon: PatientsIcon, area: "patient_records" },
      { href: "/intake", label: "Intake", icon: IntakeIcon, area: "intake", badge: { count: "intake", className: "bg-badge-blue", srLabel: "waiting for review" } },
      { href: "/tasks", label: "Tasks", icon: TasksIcon, area: "tasks", badge: { count: "tasks", className: "bg-red", srLabel: "open" } },
    ],
  },
  {
    heading: "SYSTEM",
    items: [
      { href: "/admin", label: "Admin", icon: AdminIcon, area: "audit_export" },
      { href: "/tests", label: "Tests", icon: TestsIcon },
    ],
  },
];

/** The signed-in sidebar. Shows only the screens this role can open (rules from lib/access.ts). */
export function Sidebar({ role, account, counts = {}, activeHref }: {
  role: Role;
  account: { name: string; initials: string };
  counts?: SidebarCounts;
  /** Forces the active item (preview only); normally it follows the URL. */
  activeHref?: string;
}) {
  return (
    <nav
      aria-label="Main"
      className="box-border flex flex-[1_1_236px] flex-col justify-between gap-8 border-r border-hairline/80 bg-white/78 px-4 py-[22px] shadow-nav backdrop-blur-[14px]"
    >
      <div className="flex flex-col gap-[26px]">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-1.5 text-ink no-underline">
          <IconChip color="primary" size={40}>
            <LogoIcon />
          </IconChip>
          <span className="flex flex-col">
            <span className="text-[17px] font-bold">Carebase</span>
            <span className="text-[10px] tracking-[0.14em] text-label">CLINIC OPS</span>
          </span>
        </Link>

        {NAV.map((group) => {
          const items = group.items.filter((item) => !item.area || can(role, item.area));
          if (items.length === 0) return null;
          return (
            <div key={group.heading} className="flex flex-col gap-1">
              <span className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.12em] text-label">{group.heading}</span>
              {items.map(({ href, label, icon: ItemIcon, badge }) => {
                const count = badge ? counts[badge.count] ?? 0 : 0;
                return (
                  <SidebarLink key={href} href={href} active={activeHref === undefined ? undefined : activeHref === href}>
                    <ItemIcon />
                    <span className="flex-1">{label}</span>
                    {badge && count > 0 && (
                      <span
                        className={cx(
                          "box-border flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white",
                          badge.className,
                        )}
                      >
                        {count}
                        <span className="sr-only"> {badge.srLabel}</span>
                      </span>
                    )}
                  </SidebarLink>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5 rounded-[14px] border border-[#E8EBF3] bg-surface-muted p-3">
        <Avatar initials={account.initials} gradient={ACCOUNT_GRADIENT} size={38} online />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-semibold">{account.name}</span>
          <span className="text-xs text-label">{ROLE_LABELS[role]}</span>
        </div>
        <Link
          href="/"
          aria-label="Switch role"
          title="Switch role"
          className="flex size-8 items-center justify-center rounded-lg text-label hover:bg-divider hover:text-ink"
        >
          <SwitchRoleIcon />
        </Link>
      </div>
    </nav>
  );
}

/** Same footprint as the sidebar, shown while the session loads. */
export function SidebarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex-[1_1_236px] border-r border-hairline/80 bg-white/78 shadow-nav backdrop-blur-[14px]"
    />
  );
}
