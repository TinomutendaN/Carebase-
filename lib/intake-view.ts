import { DISPLAY_FIELDS, isFieldFound, type DocKind } from "@/lib/ai/intake-schema";
import { findPatientMatch, getDocument, type IntakeDocument } from "@/lib/db/queries/intake";
import { clinicToday } from "@/lib/clinic-date";
import { approvalFor, flagsFor, flagSummary, type Approval, type PatientMatch } from "@/lib/intake-flags";

/** Everything the review screen shows for one document, worked out on the server. */
export type DocumentView = IntakeDocument & {
  summary: string;
  match: PatientMatch | null;
  approval: Approval;
  found: number;
  total: number;
};

/** The match preview: referral letters only. */
export function matchFor(doc: Pick<IntakeDocument, "kind" | "extracted">): Promise<PatientMatch> | null {
  if (doc.kind !== "referral_letter") return null;
  return findPatientMatch(doc.extracted.fields.patientName, doc.extracted.fields.birthDate);
}

export function fieldCounts(kind: DocKind, doc: IntakeDocument): { found: number; total: number } {
  const fields = DISPLAY_FIELDS[kind];
  return { found: fields.filter((f) => isFieldFound(doc.extracted.fields, f, doc.extracted.asWritten)).length, total: fields.length };
}

export async function documentView(id: string): Promise<DocumentView | null> {
  const stored = await getDocument(id);
  if (!stored) return null;
  // Flags are worked out again on each view, so an expiry is judged against today.
  const doc = stored.status === "pending" ? { ...stored, flags: flagsFor(stored.kind, stored.extracted.fields, clinicToday()) } : stored;
  const match = await matchFor(doc);
  return {
    ...doc,
    summary: flagSummary(doc.kind, doc.flags, doc.extracted.fields),
    match,
    approval: approvalFor(doc.kind, doc.flags, match),
    ...fieldCounts(doc.kind, doc),
  };
}
