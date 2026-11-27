"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { FileIcon } from "@/components/ui/icons";
import type { DisplayId, FieldKey, IntakeFields } from "@/lib/ai/intake-schema";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/format";
import type { DocumentView } from "@/lib/intake-view";

const MONO = "font-mono text-[11px]";

type Line = { id: DisplayId; label: string; value: string; state: "read" | "flag" };

/** The verbatim text for a field, falling back to the stored value. */
function written(view: DocumentView, key: FieldKey): string {
  const raw = view.extracted.asWritten[key];
  if (raw && raw.trim()) return raw.trim();
  const v: IntakeFields[FieldKey] = view.extracted.fields[key];
  if (Array.isArray(v)) return v.join(", ");
  return v;
}

function linesFor(view: DocumentView): Line[] {
  const flagged = new Set(view.flags.map((f) => f.field));
  const line = (id: DisplayId, label: string, value: string): Line => ({
    id,
    label,
    value: value || "—",
    state: flagged.has(id) || !value ? "flag" : "read",
  });
  if (view.kind === "intake_form") {
    const provider = written(view, "insuranceProvider");
    const validTo = written(view, "insuranceValidTo");
    const meds = view.extracted.asWritten.medications?.trim() || view.extracted.fields.medications.join(", ") || "None";
    return [
      line("name", "FULL NAME", written(view, "patientName")),
      line("birthDate", "DATE OF BIRTH", written(view, "birthDate")),
      line("insurance", "INSURANCE", [provider, validTo && `valid to ${validTo}`].filter(Boolean).join(" · ")),
      { id: "medications", label: "CURRENT MEDICATIONS", value: meds, state: "read" },
      line("reasonForVisit", "REASON FOR VISIT", written(view, "reasonForVisit")),
    ];
  }
  return [
    line("name", "PATIENT", written(view, "patientName")),
    line("birthDate", "DATE OF BIRTH", written(view, "birthDate")),
    line("referringDoctor", "REFERRING DOCTOR", written(view, "referringDoctor")),
    line("reasonForReferral", "REASON FOR REFERRAL", written(view, "reasonForReferral")),
    line("urgency", "URGENCY", written(view, "urgency")),
  ];
}

const LINE_STYLES = {
  read: "bg-[rgba(45,212,191,0.10)] outline-[rgba(13,148,136,0.55)]",
  flag: "bg-[rgba(251,191,36,0.18)] outline-[#D97706]",
};

function scanNote(view: DocumentView): string {
  const kind = view.fileType === "application/pdf" ? "PDF" : "PHOTO";
  const pages = `${view.extracted.pages} PAGE${view.extracted.pages === 1 ? "" : "S"}`;
  const found = view.found === view.total ? `${view.found} FIELDS FOUND` : `${view.found} OF ${view.total} FIELDS FOUND`;
  return `${kind} · ${pages} · ${found}`;
}

/** The document panel: what the AI read (as a transcript), or the original file. */
export function DocumentPreview({ view, activeField }: { view: DocumentView; activeField: DisplayId | null }) {
  const unread = view.extracted.error !== null;
  const [mode, setMode] = useState<"read" | "original">(unread ? "original" : "read");
  const fileUrl = `/api/intake/${view.id}/file`;
  const isPdf = view.fileType === "application/pdf";
  const referral = view.kind === "referral_letter";
  const f = view.extracted.fields;

  const title = referral ? (f.practice || "Referral letter").toUpperCase() : "PATIENT INTAKE FORM";
  const corner = referral
    ? [f.letterDate ? formatDate(f.letterDate) : "", f.urgency ? f.urgency.charAt(0).toUpperCase() + f.urgency.slice(1) : ""]
        .filter(Boolean)
        .join("\n")
    : `Page 1 of ${view.extracted.pages}`;

  return (
    <Panel
      tone="teal"
      aria-labelledby="doc-title"
      className="box-border flex min-w-0 flex-[2_1_380px] flex-col gap-3.5 p-[18px]!"
    >
      <PreviewHeader
        fileName={view.fileName}
        note={unread ? "COULDN'T BE READ" : scanNote(view)}
        pill={unread ? { text: "NOT READ", warn: true } : { text: "READ BY AI", warn: false }}
      />

      <div className="flex flex-1 items-center justify-center px-1.5 py-3.5">
        {mode === "read" ? (
          <div
            aria-label="Fields as read by the AI"
            className="box-border flex w-full max-w-[440px] -rotate-[1.2deg] flex-col gap-3 rounded-md bg-[#FBFAF6] px-7 pt-7 pb-8 font-mono text-[#2B2B2B] shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-start justify-between gap-3 border-b-2 border-[#2B2B2B] pb-2.5">
              <span className="text-[13px] font-semibold tracking-[0.06em]">{title}</span>
              <span className="text-right text-[10px] whitespace-pre-line text-[#6B6B6B]">{corner}</span>
            </div>
            {linesFor(view).map((ln) => (
              <div
                key={ln.id}
                className={cx(
                  "flex flex-col gap-[3px] rounded px-2 py-1.5 outline-[1.5px] outline-solid transition-shadow",
                  LINE_STYLES[ln.state],
                  activeField === ln.id && "shadow-[0_0_0_3px_rgba(76,114,240,0.45)]",
                )}
              >
                <span className="text-[9px] tracking-[0.1em] text-[#6B6B6B]">{ln.label}</span>
                <span className="border-b border-dotted border-[#9A9A9A] pb-0.5 text-[13px] break-words text-[#1E1E1E]">{ln.value}</span>
              </div>
            ))}
          </div>
        ) : isPdf ? (
          <iframe src={fileUrl} title={`Original: ${view.fileName}`} className="h-[520px] w-full max-w-[560px] rounded-md border-0 bg-white" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- served from our own API with auth; next/image can't proxy it
          <img src={fileUrl} alt={`Original: ${view.fileName}`} className="max-h-[560px] max-w-full rounded-md object-contain shadow-[0_30px_60px_rgba(0,0,0,0.45)]" />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className={cx(MONO, "text-teal-muted")}>
          {mode === "read" ? "TRANSCRIPT OF WHAT THE AI READ, NOT THE ORIGINAL" : "THE UPLOADED FILE"}
        </span>
        <div role="group" aria-label="Preview" className="flex rounded-full border border-white/14 bg-white/6 p-[3px]">
          {(["read", "original"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cx(
                "cursor-pointer rounded-full px-3 py-1 font-sans text-xs font-semibold",
                mode === m ? "bg-teal/18 text-mint" : "text-teal-muted hover:text-white",
              )}
            >
              {m === "read" ? "As read by AI" : "Original"}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function PreviewHeader({ fileName, note, pill }: { fileName: string; note: string; pill: { text: string; warn: boolean } }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id="doc-title" className="m-0 truncate text-[15px] font-bold">
          {fileName}
        </h2>
        <span className={cx(MONO, "text-teal-muted")}>{note}</span>
      </div>
      <span
        className={cx(
          MONO,
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] font-semibold",
          pill.warn ? "bg-amber/14 text-amber-soft" : "bg-teal/14 text-mint",
        )}
      >
        <span className={cx("size-1.5 rounded-full", pill.warn ? "bg-amber shadow-[0_0_8px_#FBBF24]" : "bg-teal shadow-[0_0_8px_#2DD4BF]")} />
        {pill.text}
      </span>
    </div>
  );
}

/** While the AI reads a new upload: the file under a sweeping teal beam. */
export function ReadingPreview({ fileName, url, isImage }: { fileName: string; url: string | null; isImage: boolean }) {
  return (
    <Panel tone="teal" aria-labelledby="doc-title" aria-busy="true" className="box-border flex min-w-0 flex-[2_1_380px] flex-col gap-3.5 p-[18px]!">
      <PreviewHeader fileName={fileName} note={isImage ? "PHOTO · READING…" : "PDF · READING…"} pill={{ text: "READING…", warn: false }} />
      <div className="flex flex-1 items-center justify-center px-1.5 py-3.5">
        <div className="relative max-w-[440px] overflow-hidden rounded-md shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
          {isImage && url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL for the file being uploaded
            <img src={url} alt="" className="block max-h-[480px] max-w-full opacity-80" />
          ) : (
            <div className="flex h-[420px] w-[320px] max-w-full flex-col items-center justify-center gap-3 bg-[#FBFAF6] text-[#6B6B6B]">
              <FileIcon size={40} />
              <span className="font-mono text-xs">{fileName}</span>
            </div>
          )}
          <span
            aria-hidden="true"
            className="intake-beam absolute inset-x-0 h-16 bg-linear-to-b from-transparent via-teal/45 to-transparent shadow-[0_0_24px_rgba(45,212,191,0.5)]"
          />
        </div>
      </div>
      <p role="status" className="m-0 text-center text-sm font-semibold text-mint">
        Reading document…
      </p>
    </Panel>
  );
}
