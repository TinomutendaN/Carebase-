/**
 * Date and number formatting for the screens. Dates are "YYYY-MM-DD" strings
 * (DATE columns cast ::text), read in UTC so server and browser always agree.
 */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return [y, m - 1, d];
}

/** "12 Nov 2026" */
export function formatDate(date: string): string {
  const [y, m, d] = parts(date);
  return `${d} ${MONTHS_SHORT[m]} ${y}`;
}

/** "26 Nov", for task due dates. */
export function formatDayMonth(date: string): string {
  const [, m, d] = parts(date);
  return `${d} ${MONTHS_SHORT[m]}`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Friday, 27 November", for the top bar. */
export function formatWeekdayDate(date: string): string {
  const [y, m, d] = parts(date);
  return `${WEEKDAYS[new Date(Date.UTC(y, m, d)).getUTCDay()]}, ${d} ${MONTHS_LONG[m]}`;
}

/** "02 Sep 2026", for the fixed-width mono timeline column. */
export function formatDatePadded(date: string): string {
  const [y, m, d] = parts(date);
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m]} ${y}`;
}

/** "27 November" */
export function formatDayLongMonth(date: string): string {
  const [, m, d] = parts(date);
  return `${d} ${MONTHS_LONG[m]}`;
}

/** "March 2019" */
export function formatMonthYear(date: string): string {
  const [y, m] = parts(date);
  return `${MONTHS_LONG[m]} ${y}`;
}

/** Whole years between a birth date and today (UTC). */
export function ageFrom(birthDate: string, today = new Date()): number {
  const [y, m, d] = parts(birthDate);
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() < m || (today.getUTCMonth() === m && today.getUTCDate() < d)) age -= 1;
  return age;
}

/** "Bert Hammes" → "BH" */
export function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** 4805.07 → "4,805" */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** 6.17 hours → "6h 10m" */
export function formatHours(hours: number): string {
  const total = Math.round(hours * 60);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

/** "male" → "Male" */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "5 min ago", "3 h ago", "2 days ago" */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** "14 March 1979", for editable date fields on the Intake screen. */
export function formatLongDate(date: string): string {
  const [y, m, d] = parts(date);
  return `${d} ${MONTHS_LONG[m]} ${y}`;
}

/** Real calendar date check, e.g. rejects 31 February. */
function isoIfValid(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * A date typed by staff or read off a document, as "YYYY-MM-DD", or null if it
 * can't be read. Accepts "1979-03-14", "14/03/1979" or "14 / 03 / 1979" (day first,
 * as the clinic's forms are written), and "14 March 1979" or "14 Mar 1979".
 */
export function parseDocDate(text: string): string | null {
  const t = text.trim().replace(/\s+/g, " ");
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return isoIfValid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2}) ?[/.-] ?(\d{1,2}) ?[/.-] ?(\d{4})$/.exec(t);
  if (m) return isoIfValid(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2}) ([A-Za-z]+)\.?,? (\d{4})$/.exec(t);
  if (m) {
    const name = m[2].toLowerCase();
    const month = MONTHS_LONG.findIndex((l) => l.toLowerCase() === name || l.slice(0, 3).toLowerCase() === name);
    return month < 0 ? null : isoIfValid(+m[3], month + 1, +m[1]);
  }
  return null;
}
