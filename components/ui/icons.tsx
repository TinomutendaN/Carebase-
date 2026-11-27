import type { ReactNode } from "react";

/**
 * Inline outline icons on a 24px grid (paths from designs/source).
 * Rounded caps and joins, no fills. Decorative by default (aria-hidden).
 */

export type IconProps = { size?: number; strokeWidth?: number; className?: string };

export function Icon({ size = 18, strokeWidth = 1.8, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export const LogoIcon = (p: IconProps) => (
  <Icon size={20} strokeWidth={2.2} {...p}>
    <path d="M12 3v18" />
    <path d="M3 12h18" />
    <rect x="5" y="5" width="14" height="14" rx="4" />
  </Icon>
);

export const DashboardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);

export const PatientsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    <path d="M17 4a4 4 0 0 1 0 8" />
    <path d="M22 21c0-3-1.8-5.6-4.5-6.6" />
  </Icon>
);

export const PeopleIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    <path d="M17 4a4 4 0 0 1 0 8" />
  </Icon>
);

export const IntakeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M12 12v6" />
    <path d="M9 15h6" />
  </Icon>
);

export const FileIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
  </Icon>
);

export const TasksIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8 12l3 3 5-6" />
  </Icon>
);

export const AdminIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6z" />
  </Icon>
);

export const TestsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3h6" />
    <path d="M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3" />
    <path d="M7 15h10" />
  </Icon>
);

export const FlaskIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M9 3h6" />
    <path d="M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon size={16} strokeWidth={2} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
);

export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon size={14} strokeWidth={2} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

export const SwitchRoleIcon = (p: IconProps) => (
  <Icon size={16} strokeWidth={2} {...p}>
    <path d="M8 9l4-4 4 4" />
    <path d="M8 15l4 4 4-4" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon size={14} strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const PulseIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M3 12h4l3-8 4 16 3-8h4" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon size={22} strokeWidth={2} {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon size={14} strokeWidth={2.2} {...p}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </Icon>
);

export const CalendarIcon = (p: IconProps) => (
  <Icon size={13} strokeWidth={2} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4" />
    <path d="M8 3v4" />
    <path d="M3 11h18" />
  </Icon>
);

export const GlobeIcon = (p: IconProps) => (
  <Icon size={16} strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18" />
    <path d="M12 3a14 14 0 0 0 0 18" />
  </Icon>
);

/** Three-dot menu. The one filled glyph in the designs. */
export const FileCheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M9 15l2 2 4-4" />
  </Icon>
);

export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Icon>
);

export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12l3 3 5-6" />
  </Icon>
);

export function MoreIcon({ size = 18, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

export const UploadIcon = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M12 16V4" />
    <path d="M6 10l6-6 6 6" />
    <path d="M4 20h16" />
  </Icon>
);

export const ShieldCheckIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
);

export const WarningIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M12 3L2 20h20z" />
    <path d="M12 10v4" />
    <path d="M12 17h.01" />
  </Icon>
);
