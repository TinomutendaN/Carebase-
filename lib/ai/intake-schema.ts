import { z } from "zod";
import { parseDocDate } from "@/lib/format";

/**
 * The fixed shapes for intake documents: what the model must return, what is
 * stored while staff review it, and what staff may send back when editing.
 * One flat field set covers both kinds, so staff can switch a document between
 * "intake form" and "referral letter" without a second AI call.
 */

export const DOC_KINDS = ["intake_form", "referral_letter"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_KIND_LABELS: Record<DocKind, string> = {
  intake_form: "Intake form",
  referral_letter: "Referral letter",
};

export const URGENCIES = ["routine", "soon", "urgent"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const FIELD_KEYS = [
  "patientName",
  "birthDate",
  "insuranceProvider",
  "insuranceMemberId",
  "insuranceValidTo",
  "medications",
  "reasonForVisit",
  "referringDoctor",
  "practice",
  "reasonForReferral",
  "urgency",
  "letterDate",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

/** Fields as stored and edited. "" means missing; dates are "YYYY-MM-DD". */
export type IntakeFields = {
  patientName: string;
  birthDate: string;
  insuranceProvider: string;
  insuranceMemberId: string;
  insuranceValidTo: string;
  medications: string[];
  reasonForVisit: string;
  referringDoctor: string;
  practice: string;
  reasonForReferral: string;
  urgency: Urgency | "";
  letterDate: string;
};

/** The exact text as it appears on the page, per field, or null. */
export type AsWritten = Record<FieldKey, string | null>;

export const EMPTY_FIELDS: IntakeFields = {
  patientName: "",
  birthDate: "",
  insuranceProvider: "",
  insuranceMemberId: "",
  insuranceValidTo: "",
  medications: [],
  reasonForVisit: "",
  referringDoctor: "",
  practice: "",
  reasonForReferral: "",
  urgency: "",
  letterDate: "",
};

// ---------- What each kind shows ----------

/** One labelled field on the review screen. Insurance groups three stored values. */
export type DisplayField = { id: DisplayId; label: string; paperLabel: string; keys: FieldKey[] };
export type DisplayId =
  | "name"
  | "birthDate"
  | "insurance"
  | "medications"
  | "reasonForVisit"
  | "referringDoctor"
  | "practice"
  | "reasonForReferral"
  | "urgency"
  | "letterDate";

export const DISPLAY_FIELDS: Record<DocKind, DisplayField[]> = {
  intake_form: [
    { id: "name", label: "Name", paperLabel: "FULL NAME", keys: ["patientName"] },
    { id: "birthDate", label: "Date of birth", paperLabel: "DATE OF BIRTH", keys: ["birthDate"] },
    { id: "insurance", label: "Insurance", paperLabel: "INSURANCE", keys: ["insuranceProvider", "insuranceMemberId", "insuranceValidTo"] },
    { id: "medications", label: "Medications", paperLabel: "CURRENT MEDICATIONS", keys: ["medications"] },
    { id: "reasonForVisit", label: "Reason for visit", paperLabel: "REASON FOR VISIT", keys: ["reasonForVisit"] },
  ],
  referral_letter: [
    { id: "name", label: "Patient name", paperLabel: "PATIENT", keys: ["patientName"] },
    { id: "birthDate", label: "Date of birth", paperLabel: "DATE OF BIRTH", keys: ["birthDate"] },
    { id: "referringDoctor", label: "Referring doctor", paperLabel: "REFERRING DOCTOR", keys: ["referringDoctor"] },
    { id: "practice", label: "Practice", paperLabel: "PRACTICE", keys: ["practice"] },
    { id: "reasonForReferral", label: "Reason for referral", paperLabel: "REASON FOR REFERRAL", keys: ["reasonForReferral"] },
    { id: "urgency", label: "Urgency", paperLabel: "URGENCY", keys: ["urgency"] },
    { id: "letterDate", label: "Letter date", paperLabel: "LETTER DATE", keys: ["letterDate"] },
  ],
};

function hasValue(fields: IntakeFields, key: FieldKey): boolean {
  const v = fields[key];
  return Array.isArray(v) ? v.length > 0 : v.trim() !== "";
}

/**
 * A display field counts as found when its main value is present. Medications also
 * count when the document says so in words, e.g. "None".
 */
export function isFieldFound(fields: IntakeFields, field: DisplayField, asWritten: Partial<AsWritten> = {}): boolean {
  const key = field.keys[0];
  return hasValue(fields, key) || (key === "medications" && Boolean(asWritten.medications?.trim()));
}

// ---------- What the model returns ----------

const text = (what: string) => z.string().nullable().describe(`${what} Null if it isn't on the page or can't be read.`);
const date = (what: string) =>
  z.string().nullable().describe(`${what} As YYYY-MM-DD. Null if it isn't on the page or can't be read.`);

export const ExtractionSchema = z.object({
  kind: z
    .enum(DOC_KINDS)
    .describe("intake_form: a form the patient filled in. referral_letter: a letter from another doctor referring the patient."),
  fields: z.object({
    patientName: text("The patient's full name, written as First Last (no titles)."),
    birthDate: date("The patient's date of birth. Never work it out from an age."),
    insuranceProvider: text("Insurance company or plan name."),
    insuranceMemberId: text("Insurance member or policy number."),
    insuranceValidTo: date("The date the insurance card is valid to or expires on."),
    medications: z
      .array(z.string())
      .describe('Current medications, one item per medicine with its dose and how often, e.g. "Amlodipine 5 mg once daily". Empty if none are listed or the patient wrote none.'),
    reasonForVisit: text("Why the patient is coming in, as written on an intake form."),
    referringDoctor: text('The doctor who wrote the referral, e.g. "Dr Priya Nair".'),
    practice: text("The referring doctor's practice or clinic."),
    reasonForReferral: text(
      "The clinical reason for the referral: a symptom, condition, result or question for the specialist. A request to see the patient, a greeting or a courtesy line is not a reason.",
    ),
    urgency: z.enum(URGENCIES).nullable().describe("How urgent the referral is, if stated. Null if not stated."),
    letterDate: date("The date the letter was written."),
  }),
  asWritten: z
    .object(Object.fromEntries(FIELD_KEYS.map((k) => [k, z.string().nullable()])) as Record<FieldKey, z.ZodNullable<z.ZodString>>)
    .describe("For each field, the exact characters as they appear on the page (e.g. \"14 / 03 / 1979\"), or null."),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

/** The model's answer, cleaned into stored fields. Dates it wrote in another format are re-read. */
export function fieldsFromExtraction(e: Extraction): IntakeFields {
  const t = (v: string | null) => (v ?? "").trim();
  const d = (v: string | null) => (v ? parseDocDate(v) ?? "" : "");
  const f = e.fields;
  return {
    patientName: t(f.patientName).replace(/\s+/g, " "),
    birthDate: d(f.birthDate),
    insuranceProvider: t(f.insuranceProvider),
    insuranceMemberId: t(f.insuranceMemberId),
    insuranceValidTo: d(f.insuranceValidTo),
    medications: f.medications.map((m) => m.trim()).filter(Boolean),
    reasonForVisit: t(f.reasonForVisit),
    referringDoctor: t(f.referringDoctor),
    practice: t(f.practice),
    reasonForReferral: t(f.reasonForReferral),
    urgency: f.urgency ?? "",
    letterDate: d(f.letterDate),
  };
}

// ---------- What staff send back ----------

const line = z.string().max(200);

/** The review screen's edit body. Dates and medications arrive as typed. */
export const IntakeEditSchema = z.object({
  kind: z.enum(DOC_KINDS),
  fields: z.object({
    patientName: line,
    birthDate: line,
    insuranceProvider: line,
    insuranceMemberId: line,
    insuranceValidTo: line,
    medications: z.string().max(1000),
    reasonForVisit: z.string().max(500),
    referringDoctor: line,
    practice: line,
    reasonForReferral: z.string().max(500),
    urgency: z.union([z.enum(URGENCIES), z.literal("")]),
    letterDate: line,
  }),
});
export type IntakeEdit = z.infer<typeof IntakeEditSchema>;

/** Medications as one line on screen: "Amlodipine 5 mg once daily; Metformin 500 mg twice daily". */
export function medicationsToText(items: string[]): string {
  return items.join("; ");
}

export function medicationsFromText(text: string): string[] {
  return text
    .split(/[;\n]/)
    .map((m) => m.trim())
    .filter(Boolean);
}

const DATE_KEYS = ["birthDate", "insuranceValidTo", "letterDate"] as const;

/**
 * Turns an edit into stored fields. Returns errors (per field) for dates that
 * can't be read and birth dates in the future; those are refused, not saved.
 */
export function fieldsFromEdit(
  edit: IntakeEdit["fields"],
  today: string,
): { fields: IntakeFields; errors: Partial<Record<FieldKey, string>> } {
  const errors: Partial<Record<FieldKey, string>> = {};
  const clean = (v: string) => v.trim().replace(/\s+/g, " ");
  const fields: IntakeFields = {
    ...EMPTY_FIELDS,
    patientName: clean(edit.patientName),
    insuranceProvider: clean(edit.insuranceProvider),
    insuranceMemberId: clean(edit.insuranceMemberId),
    medications: medicationsFromText(edit.medications),
    reasonForVisit: clean(edit.reasonForVisit),
    referringDoctor: clean(edit.referringDoctor),
    practice: clean(edit.practice),
    reasonForReferral: clean(edit.reasonForReferral),
    urgency: edit.urgency,
  };
  for (const key of DATE_KEYS) {
    const raw = edit[key].trim();
    if (!raw) continue;
    const iso = parseDocDate(raw);
    if (!iso) errors[key] = "Use a date like 14 March 1979 or 14/03/1979.";
    else fields[key] = iso;
  }
  if (fields.birthDate && fields.birthDate > today) errors.birthDate = "Date of birth can't be in the future.";
  return { fields, errors };
}

/** Which display fields staff changed from what the model read. */
export function editedFields(original: IntakeFields | null, current: IntakeFields): FieldKey[] {
  if (!original) return [];
  return FIELD_KEYS.filter((k) => JSON.stringify(original[k]) !== JSON.stringify(current[k]));
}
