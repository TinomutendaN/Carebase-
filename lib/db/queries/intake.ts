import { EMPTY_FIELDS, type AsWritten, type DocKind, type IntakeFields } from "@/lib/ai/intake-schema";
import { clinicTimeZone } from "@/lib/clinic-date";
import { sql } from "@/lib/db/client";
import { initialsOf } from "@/lib/format";
import type { Flag, PatientMatch } from "@/lib/intake-flags";
import { pickMrn } from "@/lib/mrn";
import { isPatientId } from "@/lib/db/queries/patients";

/**
 * Intake documents. Nothing here writes to `patients` except approveDocument(),
 * which runs only when staff approve.
 */

/** What's kept in intake_documents.extracted. */
export type Extracted = {
  fields: IntakeFields;
  asWritten: Partial<AsWritten>;
  /** What the model read, before staff edits. Null when the model couldn't read the document. */
  original: IntakeFields | null;
  pages: number;
  ms: number | null;
  model: string | null;
  error: string | null;
};

export type QueueItem = {
  id: string;
  kind: DocKind;
  fileName: string;
  name: string;
  flagged: boolean;
};

export type ApprovedItem = { id: string; kind: DocKind; name: string; patientId: string | null };

export type IntakeDocument = {
  id: string;
  kind: DocKind;
  fileName: string;
  fileType: string;
  extracted: Extracted;
  flags: Flag[];
  status: "pending" | "approved" | "rejected";
  patientId: string | null;
};

/** Ids are UUIDs, like patients. */
export const isDocumentId = isPatientId;

function toExtracted(raw: unknown): Extracted {
  const e = (raw ?? {}) as Partial<Extracted>;
  return {
    fields: { ...EMPTY_FIELDS, ...(e.fields ?? {}) },
    asWritten: e.asWritten ?? {},
    original: e.original ?? null,
    pages: e.pages ?? 1,
    ms: e.ms ?? null,
    model: e.model ?? null,
    error: e.error ?? null,
  };
}

// ---------- Reading ----------

/** Documents waiting for review, oldest first. */
export async function listPending(): Promise<QueueItem[]> {
  const rows = await sql`
    SELECT id, kind, file_name, extracted->'fields'->>'patientName' AS name, jsonb_array_length(flags) > 0 AS flagged
    FROM intake_documents WHERE status = 'pending'
    ORDER BY uploaded_at, id
  `;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    fileName: r.file_name,
    name: r.name?.trim() || r.file_name,
    flagged: r.flagged,
  }));
}

/** Documents approved today (clinic time), newest first. */
export async function listApprovedToday(today: string): Promise<ApprovedItem[]> {
  const rows = await sql`
    SELECT d.id, d.kind, d.patient_id, d.file_name,
           coalesce(p.first_name || ' ' || p.last_name, d.extracted->'fields'->>'patientName') AS name
    FROM intake_documents d LEFT JOIN patients p ON p.id = d.patient_id
    WHERE d.status = 'approved' AND (d.reviewed_at AT TIME ZONE ${clinicTimeZone()})::date = ${today}::date
    ORDER BY d.reviewed_at DESC
  `;
  return rows.map((r) => ({ id: r.id, kind: r.kind, name: r.name || r.file_name, patientId: r.patient_id }));
}

export async function getDocument(id: string): Promise<IntakeDocument | null> {
  if (!isDocumentId(id)) return null;
  const rows = await sql`
    SELECT id, kind, file_name, file_type, extracted, flags, status, patient_id
    FROM intake_documents WHERE id = ${id}
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    kind: r.kind,
    fileName: r.file_name,
    fileType: r.file_type,
    extracted: toExtracted(r.extracted),
    flags: r.flags as Flag[],
    status: r.status,
    patientId: r.patient_id,
  };
}

export async function getDocumentFile(id: string): Promise<{ fileName: string; fileType: string; data: Buffer } | null> {
  if (!isDocumentId(id)) return null;
  const rows = await sql`
    SELECT file_name, file_type, encode(file_data, 'base64') AS data FROM intake_documents WHERE id = ${id}
  `;
  const r = rows[0];
  if (!r) return null;
  return { fileName: r.file_name, fileType: r.file_type, data: Buffer.from(r.data, "base64") };
}

/** Uploads today (clinic time), for the daily extraction limit. Every upload counts, whatever happened to it. */
export async function countUploadsToday(today: string): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS n FROM intake_documents
    WHERE (uploaded_at AT TIME ZONE ${clinicTimeZone()})::date = ${today}::date
  `;
  return Number(rows[0].n);
}

// ---------- Matching ----------

/**
 * A referral letter matches a patient when the full name (ignoring case and
 * extra spaces) and the date of birth are both the same.
 */
export async function findPatientMatch(name: string, birthDate: string): Promise<PatientMatch> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || !birthDate) return { status: "incomplete" };
  const rows = await sql`
    SELECT id, first_name, last_name, mrn FROM patients
    WHERE lower(first_name || ' ' || last_name) = lower(${clean}) AND birth_date = ${birthDate}::date
    ORDER BY mrn LIMIT 5
  `;
  if (rows.length === 0) return { status: "none" };
  if (rows.length > 1) return { status: "multiple", count: rows.length };
  const r = rows[0];
  return {
    status: "match",
    patient: { id: r.id, name: `${r.first_name} ${r.last_name}`, initials: initialsOf(r.first_name, r.last_name), mrn: r.mrn },
  };
}

// ---------- Writing (intake_documents only) ----------

export async function insertDocument(doc: {
  kind: DocKind;
  fileName: string;
  fileType: string;
  data: Uint8Array;
  uploadedById: number;
  extracted: Extracted;
  flags: Flag[];
}): Promise<string> {
  const rows = await sql`
    INSERT INTO intake_documents (kind, file_name, file_type, file_data, extracted, flags, uploaded_by_id)
    VALUES (${doc.kind}, ${doc.fileName}, ${doc.fileType}, decode(${Buffer.from(doc.data).toString("base64")}, 'base64'),
            ${JSON.stringify(doc.extracted)}::jsonb, ${JSON.stringify(doc.flags)}::jsonb, ${doc.uploadedById})
    RETURNING id
  `;
  return rows[0].id;
}

/** Saves the model's reading, or staff edits. Only while the document is pending. Returns false otherwise. */
export async function saveExtraction(id: string, kind: DocKind, extracted: Extracted, flags: Flag[]): Promise<boolean> {
  const rows = await sql`
    UPDATE intake_documents
    SET kind = ${kind}, extracted = ${JSON.stringify(extracted)}::jsonb, flags = ${JSON.stringify(flags)}::jsonb
    WHERE id = ${id} AND status = 'pending'
    RETURNING id
  `;
  return rows.length > 0;
}

export async function rejectDocument(id: string, kind: DocKind, extracted: Extracted, flags: Flag[], reviewerId: number): Promise<boolean> {
  const rows = await sql`
    UPDATE intake_documents
    SET status = 'rejected', kind = ${kind}, extracted = ${JSON.stringify(extracted)}::jsonb,
        flags = ${JSON.stringify(flags)}::jsonb, reviewed_by_id = ${reviewerId}, reviewed_at = now()
    WHERE id = ${id} AND status = 'pending'
    RETURNING id
  `;
  return rows.length > 0;
}

// ---------- Approval: the only writes to patients ----------

/** "Bert Hammes" → ["Bert", "Hammes"]; "Mary Ann Lee" → ["Mary Ann", "Lee"]. */
export function splitName(full: string): [string, string] {
  const words = full.trim().split(/\s+/);
  if (words.length < 2) return [words[0] ?? "", words[0] ?? ""];
  return [words.slice(0, -1).join(" "), words[words.length - 1]];
}

/** "Amlodipine 5 mg once daily" → name "Amlodipine", dose "5 mg once daily". */
export function splitMedication(text: string): { name: string; dose: string | null } {
  const m = /^(.*?)\s+(\d.*)$/.exec(text.trim());
  if (!m || !m[1]) return { name: text.trim(), dose: null };
  return { name: m[1], dose: m[2] };
}

export type ApprovalResult = { patientId: string; mrn: string; name: string; created: boolean };

/**
 * Approves a pending document in one transaction. With `attachTo`, links the
 * document to that patient and changes nothing else. Otherwise creates the
 * patient (source 'intake', a new 5-digit MRN) and, for intake forms, their
 * insurance and medications. Returns null if the document wasn't pending.
 */
export async function approveDocument(input: {
  id: string;
  kind: DocKind;
  extracted: Extracted;
  flags: Flag[];
  reviewerId: number;
  attachTo: { id: string; name: string; mrn: string } | null;
}): Promise<ApprovalResult | null> {
  const { id, kind, extracted, flags, reviewerId, attachTo } = input;
  const json = JSON.stringify(extracted);
  const flagsJson = JSON.stringify(flags);

  if (attachTo) {
    const rows = await sql`
      UPDATE intake_documents
      SET status = 'approved', kind = ${kind}, extracted = ${json}::jsonb, flags = ${flagsJson}::jsonb,
          patient_id = ${attachTo.id}, reviewed_by_id = ${reviewerId}, reviewed_at = now()
      WHERE id = ${id} AND status = 'pending'
      RETURNING id
    `;
    return rows.length ? { patientId: attachTo.id, mrn: attachTo.mrn, name: attachTo.name, created: false } : null;
  }

  const f = extracted.fields;
  const [firstName, lastName] = splitName(f.patientName);
  const isForm = kind === "intake_form";
  const meds = isForm ? f.medications.map(splitMedication) : [];

  for (let attempt = 0; ; attempt++) {
    const taken = new Set((await sql`SELECT mrn FROM patients`).map((r) => r.mrn as string));
    const mrn = pickMrn(id, taken);
    const patientId = crypto.randomUUID();
    try {
      const [, inserted, , updated] = await sql.transaction([
        // Lock the document so a second approval waits, then sees it's no longer pending.
        sql`SELECT id FROM intake_documents WHERE id = ${id} AND status = 'pending' FOR UPDATE`,
        sql`
          INSERT INTO patients (id, mrn, first_name, last_name, birth_date,
                                insurance_provider, insurance_member_id, insurance_expires_on, source)
          SELECT ${patientId}, ${mrn}, ${firstName}, ${lastName}, ${f.birthDate}::date,
                 ${isForm ? f.insuranceProvider || null : null}, ${isForm ? f.insuranceMemberId || null : null},
                 ${isForm && f.insuranceValidTo ? f.insuranceValidTo : null}::date, 'intake'
          WHERE EXISTS (SELECT 1 FROM intake_documents WHERE id = ${id} AND status = 'pending')
          RETURNING id
        `,
        sql`
          INSERT INTO medications (patient_id, name, dose, status)
          SELECT p.id, m.name, m.dose, 'active'
          FROM patients p, unnest(${meds.map((m) => m.name)}::text[], ${meds.map((m) => m.dose)}::text[]) AS m(name, dose)
          WHERE p.id = ${patientId}
        `,
        sql`
          UPDATE intake_documents
          SET status = 'approved', kind = ${kind}, extracted = ${json}::jsonb, flags = ${flagsJson}::jsonb,
              patient_id = ${patientId}, reviewed_by_id = ${reviewerId}, reviewed_at = now()
          WHERE id = ${id} AND status = 'pending' AND EXISTS (SELECT 1 FROM patients WHERE id = ${patientId})
          RETURNING id
        `,
      ]);
      if (!inserted.length || !updated.length) return null;
      return { patientId, mrn, name: `${firstName} ${lastName}`, created: true };
    } catch (error) {
      // Another approval took the same MRN between reading and inserting: try once more.
      const duplicateMrn = String((error as { constraint?: string }).constraint ?? "").includes("mrn");
      if (attempt === 0 && duplicateMrn) continue;
      throw error;
    }
  }
}
