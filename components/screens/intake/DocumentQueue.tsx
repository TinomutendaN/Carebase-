"use client";

import Link from "next/link";
import { useRef, type ChangeEvent } from "react";
import { StatusTag } from "@/components/ui/StatusTag";
import { CheckCircleIcon, FileIcon, UploadIcon } from "@/components/ui/icons";
import { DOC_KIND_LABELS } from "@/lib/ai/intake-schema";
import { cx } from "@/lib/cx";
import type { ApprovedItem, QueueItem } from "@/lib/db/queries/intake";

export const ACCEPT = "application/pdf,image/jpeg,image/png";
export const MAX_BYTES = 4 * 1024 * 1024;

const HEADING = "text-[11px] font-bold tracking-[0.12em] text-label";

/** Left column: upload, documents waiting for review, and those approved today. */
export function DocumentQueue({ queue, approved, selectedId, reading, notice, onUpload, onSelect }: {
  queue: QueueItem[];
  approved: ApprovedItem[];
  selectedId: string | null;
  /** The file being read right now, if any. */
  reading: string | null;
  notice: { tone: "error" | "success"; text: string } | null;
  onUpload: (file: File) => void;
  onSelect: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  function picked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onUpload(file);
  }

  return (
    <section
      aria-labelledby="queue-title"
      className="box-border flex min-w-0 flex-[1_1_280px] flex-col gap-3.5 rounded-[22px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft p-[18px] shadow-card"
    >
      <h2 id="queue-title" className="m-0 text-base font-bold">
        Documents
      </h2>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={reading !== null}
          onClick={() => input.current?.click()}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[#9DB2F7] bg-[#F4F7FF] px-3.5 py-[18px] font-sans text-primary-ink disabled:cursor-progress disabled:opacity-70"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-linear-145 from-primary to-[#2F55E0] text-white shadow-[0_6px_16px_rgba(47,85,224,0.35)]">
            <UploadIcon />
          </span>
          <span className="text-sm font-bold">Upload intake form or referral letter</span>
          <span className="text-xs text-secondary">PDF or photo</span>
        </button>
        <input ref={input} type="file" accept={ACCEPT} onChange={picked} className="sr-only" tabIndex={-1} aria-hidden="true" />
        <p className="m-0 text-center text-xs text-secondary">Demo only. Don&apos;t upload real patient documents.</p>
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cx(
            "m-0 rounded-xl border px-3 py-2.5 text-[13px] leading-snug",
            notice.tone === "error" ? "border-[#F3A3A0] bg-[#FFF7F7] text-[#B42318]" : "border-[#A7E3C1] bg-[#ECFDF3] text-[#166534]",
          )}
        >
          {notice.text}
        </p>
      )}

      <span className={HEADING}>WAITING FOR REVIEW · {queue.length + (reading ? 1 : 0)}</span>
      <div className="flex flex-col gap-2">
        {queue.map((q) => {
          const on = q.id === selectedId;
          const form = q.kind === "intake_form";
          return (
            <button
              key={q.id}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(q.id)}
              className={cx(
                "flex w-full cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] p-3 text-left font-sans text-ink",
                on ? "border-primary bg-[#F4F7FF]" : "border-[#E8EBF3] bg-surface hover:bg-surface-soft",
              )}
            >
              <span
                className={cx(
                  "flex size-9 flex-none items-center justify-center rounded-[10px]",
                  form ? "bg-[#EAF0FF] text-[#2F5BEA]" : "bg-[#F0EAFE] text-[#6D4AE8]",
                )}
              >
                <FileIcon size={16} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13px] font-bold">{q.name}</span>
                <span className="truncate text-xs text-secondary">
                  {DOC_KIND_LABELS[q.kind]} · {q.fileName}
                </span>
              </span>
              <StatusTag status={q.flagged ? "flagged" : "ready"} className="flex-none" />
            </button>
          );
        })}
        {reading && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-primary bg-[#F4F7FF] p-3"
          >
            <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-[#EAF0FF]">
              <span className="size-4 animate-spin rounded-full border-2 border-[#2F5BEA]/25 border-t-[#2F5BEA]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-bold">Reading document…</span>
              <span className="truncate text-xs text-secondary">{reading}</span>
            </span>
          </div>
        )}
        {queue.length === 0 && !reading && <p className="m-0 text-[13px] text-secondary">Nothing waiting. Upload a document to start.</p>}
      </div>

      <span className={HEADING}>APPROVED TODAY · {approved.length}</span>
      <div className="flex flex-col gap-0.5">
        {approved.map((a) => (
          <div key={a.id} className="flex items-center gap-2.5 px-1 py-2 text-[13px] text-nav-text">
            <CheckCircleIcon size={16} strokeWidth={2.2} className="flex-none text-[#15803D]" />
            {a.patientId ? (
              <Link href={`/patients/${a.patientId}`} className="flex-1 truncate text-nav-text no-underline hover:text-primary-ink">
                {a.name}
              </Link>
            ) : (
              <span className="flex-1 truncate">{a.name}</span>
            )}
            <span className="text-xs text-label">{DOC_KIND_LABELS[a.kind]}</span>
          </div>
        ))}
        {approved.length === 0 && <p className="m-0 px-1 text-[13px] text-secondary">None yet today.</p>}
      </div>
    </section>
  );
}
