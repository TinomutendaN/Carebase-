/**
 * The clinic's calendar. "Today" is the date on the clinic's wall, not the
 * server's (Vercel runs in UTC). Used for expiry checks, "approved today",
 * and (Step 7) tasks due today or overdue.
 */

const DEFAULT_TIMEZONE = "America/New_York";

export function clinicTimeZone(): string {
  const zone = process.env.CLINIC_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return zone;
  } catch {
    throw new Error(`CLINIC_TIMEZONE "${zone}" is not a valid IANA time zone, e.g. America/New_York.`);
  }
}

/** The clinic's date for a moment in time, as "YYYY-MM-DD". */
export function clinicDate(at: Date = new Date()): string {
  return at.toLocaleDateString("en-CA", { timeZone: clinicTimeZone() });
}

/** Today's date at the clinic, as "YYYY-MM-DD". */
export function clinicToday(): string {
  return clinicDate();
}

/** A "YYYY-MM-DD" date moved by whole days, e.g. addDays("2026-11-25", 2) → "2026-11-27". */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week a date falls in, for "Done this week". */
export function weekStart(date: string): string {
  const day = new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((day + 6) % 7));
}
