import { connection } from "next/server";
import { EMPTY_FIELDS, type DocKind } from "@/lib/ai/intake-schema";
import { extractIntake } from "@/lib/ai/extract-intake";
import { logChange } from "@/lib/audit";
import { clinicToday } from "@/lib/clinic-date";
import { countUploadsToday, insertDocument, saveExtraction, type Extracted } from "@/lib/db/queries/intake";
import { requireIntakeAccess, NO_STORE } from "@/lib/intake-access";
import { flagsFor } from "@/lib/intake-flags";
import { documentView } from "@/lib/intake-view";

/** The model call can take a while on a photo. */
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;

/** Accepted types, checked by their first bytes as well as the browser's MIME type. */
const SIGNATURES: { type: string; bytes: number[] }[] = [
  { type: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

function sniff(data: Uint8Array): string | null {
  return SIGNATURES.find((s) => s.bytes.every((b, i) => data[i] === b))?.type ?? null;
}

/** Page count from a PDF's page objects; 1 for images or if it can't tell. */
function countPages(data: Uint8Array, type: string): number {
  if (type !== "application/pdf") return 1;
  const n = (Buffer.from(data).toString("latin1").match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length;
  return Math.max(1, n);
}

function dailyLimit(): number {
  const n = Number(process.env.INTAKE_DAILY_LIMIT);
  return Number.isInteger(n) && n >= 0 ? n : 50;
}

/**
 * POST /api/intake (multipart, field "file") — upload one PDF, JPG or PNG up to 4 MB.
 * The document is stored first, then read by the model. Nothing is written to patients.
 */
export async function POST(request: Request) {
  await connection();
  const access = await requireIntakeAccess("POST /api/intake");
  if ("response" in access) return access.response;
  const { session } = access;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "The file is empty." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Files can be up to 4 MB." }, { status: 413 });

  const data = new Uint8Array(await file.arrayBuffer());
  const type = sniff(data);
  if (!type || type !== file.type) {
    return Response.json({ error: "Upload a PDF, JPG or PNG." }, { status: 415 });
  }

  const today = clinicToday();
  const limit = dailyLimit();
  if ((await countUploadsToday(today)) >= limit) {
    return Response.json(
      { error: `The demo reads up to ${limit} documents a day. Try again tomorrow.` },
      { status: 429, headers: NO_STORE },
    );
  }

  const fileName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "document";
  const empty: Extracted = { fields: EMPTY_FIELDS, asWritten: {}, original: null, pages: countPages(data, type), ms: null, model: null, error: null };
  const id = await insertDocument({
    kind: "intake_form",
    fileName,
    fileType: type,
    data,
    uploadedById: session.accountId,
    extracted: empty,
    flags: flagsFor("intake_form", EMPTY_FIELDS, today),
  });

  let kind: DocKind = "intake_form";
  let extracted: Extracted;
  try {
    const result = await extractIntake({ data, mediaType: type, name: fileName });
    kind = result.kind;
    extracted = { ...empty, fields: result.fields, asWritten: result.asWritten, original: result.fields, ms: result.ms, model: result.model };
  } catch (error) {
    console.error("Intake extraction failed", error);
    extracted = { ...empty, error: "The AI couldn't read this document. Fill in the fields yourself, or reject it." };
  }
  await saveExtraction(id, kind, extracted, flagsFor(kind, extracted.fields, today));

  await logChange(
    session,
    "Uploaded intake document",
    { type: "intake_document", id, label: fileName },
    { kind, ms: extracted.ms, model: extracted.model, read: !extracted.error },
  );

  const view = await documentView(id);
  return Response.json(view, { status: 201, headers: NO_STORE });
}
