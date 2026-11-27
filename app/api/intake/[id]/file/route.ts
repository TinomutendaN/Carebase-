import { connection } from "next/server";
import { logView } from "@/lib/audit";
import { getDocumentFile, isDocumentId } from "@/lib/db/queries/intake";
import { requireIntakeAccess } from "@/lib/intake-access";

/**
 * GET /api/intake/{id}/file — the uploaded document itself, for the preview.
 * Served with its stored type, inline, never sniffed or cached. Every load is logged.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const access = await requireIntakeAccess("GET /api/intake/[id]/file");
  if ("response" in access) return access.response;

  const { id } = await params;
  if (!isDocumentId(id)) return Response.json({ error: "No document with this id." }, { status: 404 });
  const file = await getDocumentFile(id);
  if (!file) return Response.json({ error: "No document with this id." }, { status: 404 });

  await logView(access.session, "Viewed intake document", { type: "intake_document", id, label: file.fileName });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.fileType,
      "Content-Length": String(file.data.length),
      "Content-Disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
