import Link from "next/link";
import type { ReactNode } from "react";
import { ACCOUNT_GRADIENT, Avatar } from "@/components/ui/Avatar";
import { BellIcon, ChevronDownIcon, SearchIcon } from "@/components/ui/icons";

/**
 * The frosted top bar: "CAREBASE › SECTION" breadcrumb and the page title.
 * The right side differs per screen in the designs, so it's a slot.
 */
export function TopBar({ section, title, children }: { section: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline/80 bg-white/70 px-8 py-[18px] backdrop-blur-[14px]">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-label">
          CAREBASE <span aria-hidden="true">›</span> <span className="text-primary-ink">{section}</span>
        </span>
        <h1 className="m-0 text-xl font-bold">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}

/** Patient search field. Visual only for now; search behaviour arrives in Step 5. */
export function SearchField({ placeholder = "Search patients…" }: { placeholder?: string }) {
  return (
    <label className="focus-frame box-border flex h-11 w-80 max-w-full items-center gap-2.5 rounded-xl border border-field-border bg-surface pr-3 pl-3.5 text-label shadow-field">
      <SearchIcon />
      <span className="sr-only">Search patients</span>
      <input
        type="search"
        placeholder={placeholder}
        className="min-w-0 flex-1 border-none bg-transparent font-sans text-sm text-ink outline-none placeholder:text-label"
      />
      <kbd className="rounded-md border border-field-border bg-tab-track px-[7px] py-0.5 font-sans text-[11px] font-semibold text-secondary">
        ⌘K
      </kbd>
    </label>
  );
}

/** Bell linking to Tasks, with the number of tasks due today. */
export function TaskBell({ count }: { count: number }) {
  return (
    <Link
      href="/tasks"
      aria-label={`${count} ${count === 1 ? "task" : "tasks"} due today`}
      className="relative flex size-11 items-center justify-center rounded-xl border border-field-border bg-surface text-nav-text shadow-field"
    >
      <BellIcon />
      {count > 0 && (
        <span className="absolute top-1.5 right-1.5 box-border flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

/** The signed-in account's initials in the top bar. */
export function TopBarAccount({ initials }: { initials: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Avatar initials={initials} gradient={ACCOUNT_GRADIENT} shape="square" size={40} />
      <ChevronDownIcon className="text-label" />
    </div>
  );
}
