import { connection } from "next/server";
import { z } from "zod";
import { DOC_KIND_LABELS, editedFields, fieldsFromEdit, IntakeEditSchema } from "@/lib/ai/intake-schema";
import { logChange } from "@/lib/audit";
import { clinicToday } from "@/lib/clinic-date";
import { approveDocument, getDocument, rejectDocument, saveExtraction } from "@/lib/db/queries/intake";
import { NO_STORE, requireIntakeAccess } from "@/lib/intake-access";
import { approvalFor, flagsFor, hasMissing } from "@/lib/intake-flags";
import { documentView, matchFor } from "@/lib/intake-view";

type Params = { params: Promise<{ id: string }> };

const ReviewSchema = IntakeEditSchema.extend({ action: z.enum(["approve", "reject"]) });

const notPending = () => Response.json({ error: "This document has already been reviewed." }, { status: 409, headers: NO_STORE });
const notFound = () => Response.json({ error: "No document with this id." }, { status: 404, headers: NO_STORE });

async function load(params: Params["params"]) {
  const { id } = await params;
  return getDocument(id);
}

/**
 * PATCH /api/intake/{id} — save staff edits to a pending document: { kind, fields }.
 * Flags and the referral match are worked out again. Never writes to patients.
 */
export async function PATCH(request: Request, { params }: Params) {
  await connection();
  const access = await requireIntakeAccess("PATCH /api/intake/[id]");
  if ("response" in access) return access.response;

  const doc = await load(params);
  if (!doc) return notFound();
  if (doc.status !== "pending") return notPending();

  const body = IntakeEditSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Check the fields and try again." }, { status: 400, headers: NO_STORE });

  const today = clinicToday();
  const { fields, errors } = fieldsFromEdit(body.data.fields, today);
  if (Object.keys(errors).length) return Response.json({ error: "Some fields need fixing.", errors }, { status: 400, headers: NO_STORE });

  const saved = await saveExtraction(doc.id, body.data.kind, { ...doc.extracted, fields }, flagsFor(body.data.kind, fields, today));
  if (!saved) return notPending();
  return Response.json(await documentView(doc.id), { headers: NO_STORE });
}

/**
 * POST /api/intake/{id} — { action: "approve" | "reject", kind, fields }.
 * Approve is refused (422) while a required field is missing. An intake form
 * creates the patient; a referral letter attaches to the patient with the same
 * name and date of birth, or creates one if there's none.
 */
export async function POST(request: Request, { params }: Params) {
  await connection();
  const access = await requireIntakeAccess("POST /api/intake/[id]");
  if ("response" in access) return access.response;
  const { session } = access;

  const doc = await load(params);
  if (!doc) return notFound();
  if (doc.status !== "pending") return notPending();

  const body = ReviewSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Check the fields and try again." }, { status: 400, headers: NO_STORE });
  const { action, kind } = body.data;

  const today = clinicToday();
  const { fields, errors } = fieldsFromEdit(body.data.fields, today);
  const label = fields.patientName || doc.fileName;

  if (action === "reject") {
    // A bad date shouldn't stop a rejection: keep what was saved before.
    const kept = Object.keys(errors).length ? doc.extracted.fields : fields;
    const done = await rejectDocument(doc.id, kind, { ...doc.extracted, fields: kept }, flagsFor(kind, kept, today), session.accountId);
    if (!done) return notPending();
    await logChange(session, `Rejected ${DOC_KIND_LABELS[kind].toLowerCase()}`, { type: "intake_document", id: doc.id, label }, {
      file: doc.fileName,
    });
    return Response.json({ status: "rejected" }, { headers: NO_STORE });
  }

  if (Object.keys(errors).length) return Response.json({ error: "Some fields need fixing.", errors }, { status: 400, headers: NO_STORE });

  const flags = flagsFor(kind, fields, today);
  const extracted = { ...doc.extracted, fields };
  const match = await matchFor({ kind, extracted });
  const approval = approvalFor(kind, flags, match);
  if (approval.blocked) {
    const error = hasMissing(flags) ? "Fill the missing fields before approving." : "More than one patient matches this letter.";
    return Response.json({ error, flags }, { status: 422, headers: NO_STORE });
  }

  const attachTo = match?.status === "match" ? match.patient : null;
  const result = await approveDocument({ id: doc.id, kind, extracted, flags, reviewerId: session.accountId, attachTo });
  if (!result) return notPending();

  const action_ =
    kind === "intake_form"
      ? "Approved intake form, created"
      : result.created
        ? "Approved referral letter, created"
        : "Approved referral letter, attached to";
  await logChange(session, action_, { type: "patient", id: result.patientId, label: result.name }, {
    document_id: doc.id,
    file: doc.fileName,
    mrn: result.mrn,
    edited_fields: editedFields(doc.extracted.original, fields),
    warnings: flags.filter((f) => f.kind === "expired").map((f) => f.message),
  });

  return Response.json({ status: "approved", ...result }, { headers: NO_STORE });
}
