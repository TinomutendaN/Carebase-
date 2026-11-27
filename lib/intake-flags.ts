import type { DisplayId, DocKind, IntakeFields } from "@/lib/ai/intake-schema";
import { formatDate } from "@/lib/format";

/**
 * The intake flag rules, worked out in code (never by the model):
 * - a required field is missing → approval is blocked
 * - the insurance card's "valid to" date is before today → a warning only
 * Plus the approve button's label, which depends on the flags and, for a
 * referral letter, on whether it matches an existing patient.
 */

export type Flag = { field: DisplayId; kind: "missing" | "expired"; message: string };

export const REQUIRED: Record<DocKind, { id: DisplayId; key: keyof IntakeFields; label: string }[]> = {
  intake_form: [
    { id: "name", key: "patientName", label: "name" },
    { id: "birthDate", key: "birthDate", label: "date of birth" },
    { id: "insurance", key: "insuranceProvider", label: "insurance" },
    { id: "reasonForVisit", key: "reasonForVisit", label: "reason for visit" },
  ],
  referral_letter: [
    { id: "name", key: "patientName", label: "patient name" },
    { id: "birthDate", key: "birthDate", label: "date of birth" },
    { id: "referringDoctor", key: "referringDoctor", label: "referring doctor" },
    { id: "reasonForReferral", key: "reasonForReferral", label: "reason for referral" },
  ],
};

/** `today` is the clinic's date, "YYYY-MM-DD" (lib/clinic-date.ts). */
export function flagsFor(kind: DocKind, fields: IntakeFields, today: string): Flag[] {
  const flags: Flag[] = [];
  for (const r of REQUIRED[kind]) {
    const v = fields[r.key];
    if (typeof v === "string" && v.trim() === "") {
      flags.push({ field: r.id, kind: "missing", message: `${sentenceCase(r.label)} is missing.` });
    } else if (r.key === "patientName" && !/\S\s+\S/.test(fields.patientName)) {
      // A patient record needs a first and a last name.
      flags.push({ field: r.id, kind: "missing", message: "Add both the first and last name." });
    }
  }
  if (kind === "intake_form" && fields.insuranceValidTo && fields.insuranceValidTo < today) {
    flags.push({
      field: "insurance",
      kind: "expired",
      message: `Insurance card expired on ${formatDate(fields.insuranceValidTo)}.`,
    });
  }
  return flags;
}

export function hasMissing(flags: Flag[]): boolean {
  return flags.some((f) => f.kind === "missing");
}

/** The warning box text, in the design's wording. Empty when there's nothing to say. */
export function flagSummary(kind: DocKind, flags: Flag[], fields: IntakeFields): string {
  const parts: string[] = [];
  const missing = flags.filter((f) => f.kind === "missing");
  if (missing.length) {
    const labels = missing.map((f) => REQUIRED[kind].find((r) => r.id === f.field)?.label ?? f.field);
    const one = labels.length === 1;
    const who =
      kind === "referral_letter"
        ? fields.practice
          ? `Contact ${fields.practice}`
          : "Contact the referring practice"
        : "Ask the patient";
    parts.push(
      `${sentenceCase(joinAnd(labels))} ${one ? "is" : "are"} missing. ${who}, or add ${one ? "it" : "them"} yourself, before approving.`,
    );
  }
  const expired = flags.find((f) => f.kind === "expired");
  if (expired) parts.push(`${expired.message} Ask the patient for an updated card before approving.`);
  return parts.join(" ");
}

/** Whether a referral letter matches a patient already on record (name and date of birth). */
export type PatientMatch =
  | { status: "match"; patient: { id: string; name: string; initials: string; mrn: string } }
  | { status: "none" }
  | { status: "incomplete" }
  | { status: "multiple"; count: number };

export type Approval = { label: string; blocked: boolean; action: "create" | "attach" | null };

export function approvalFor(kind: DocKind, flags: Flag[], match: PatientMatch | null): Approval {
  if (hasMissing(flags)) return { label: "Fill the missing fields to approve", blocked: true, action: null };
  if (kind === "referral_letter") {
    if (match?.status === "match") return { label: "Approve and attach to record", blocked: false, action: "attach" };
    if (match?.status === "multiple") return { label: "Check the matching patients to approve", blocked: true, action: null };
  }
  return { label: "Approve and create patient", blocked: false, action: "create" };
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
