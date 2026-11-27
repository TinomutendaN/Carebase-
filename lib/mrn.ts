/**
 * Medical record numbers: unique 5-digit strings (10000–99999). A seed (the
 * Synthea patient id, or the intake document id) picks a stable starting
 * number, then it steps up until it finds one not yet taken.
 */

/** FNV-1a, for a stable starting point when assigning MRNs. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The first unused MRN at or after the seed's starting point. Doesn't add it to `taken`. */
export function pickMrn(seed: string, taken: Set<string>): string {
  if (taken.size >= 90000) throw new Error("No 5-digit MRNs left.");
  let n = 10000 + (fnv1a(seed) % 90000);
  while (taken.has(String(n))) n = n === 99999 ? 10000 : n + 1;
  return String(n);
}
