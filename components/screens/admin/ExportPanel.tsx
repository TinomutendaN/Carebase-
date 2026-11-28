"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconChip } from "@/components/ui/IconChip";
import { CheckCircleIcon, DownloadIcon } from "@/components/ui/icons";
import type { PreviewField } from "@/lib/deidentify";

const RULES = ["Names and identifiers removed", "Birth dates reduced to the year", "All dates shifted"];

/**
 * The de-identified export (dark teal panel in designs/06-admin.png): the rules,
 * a before-and-after preview of one real patient, and the export button, which
 * downloads the JSON file from POST /api/export and then refreshes "Last export".
 */
export function ExportPanel({ patientCount, preview, lastExport }: {
  patientCount: number;
  preview: PreviewField[];
  /** "11:05 EST today by Demo Admin", or null before the first export. */
  lastExport: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/export", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "The export failed. Try again.");
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "carebase-deidentified.json";
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The export failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="export-title"
      className="on-dark flex flex-col gap-3.5 rounded-[26px] border border-mint/14 bg-[radial-gradient(420px_260px_at_50%_20%,rgba(45,212,191,0.18),transparent_70%),linear-gradient(165deg,#0F3142,#0A1C2B)] p-[22px] text-white shadow-[0_28px_70px_rgba(8,30,45,0.35)]"
    >
      <div className="flex items-center gap-3">
        <IconChip color="teal" size={40}>
          <DownloadIcon />
        </IconChip>
        <div className="flex flex-col gap-0.5">
          <h2 id="export-title" className="m-0 text-base font-bold">De-identified export</h2>
          <span className="text-xs text-teal-muted">All {patientCount} patients, with identifiers removed</span>
        </div>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {RULES.map((rule) => (
          <li key={rule} className="flex items-center gap-2.5 text-[13px]">
            <CheckCircleIcon size={16} strokeWidth={2.4} className="flex-none text-mint" />
            {rule}
          </li>
        ))}
      </ul>

      <span className="font-mono text-[11px] tracking-[0.14em] text-mint-label">PREVIEW · ONE ROW</span>
      <dl className="m-0 flex flex-col gap-1.5 rounded-[14px] border border-white/8 bg-[rgba(3,16,26,0.5)] p-3 font-mono text-xs">
        {preview.map((f) => (
          <div key={f.field} className="flex flex-wrap items-center gap-2">
            <dt className="flex-[0_0_74px] text-[10px] tracking-[0.08em] text-chart-text">{f.field}</dt>
            <dd className="m-0 flex min-w-0 flex-[1_1_180px] flex-wrap items-center gap-x-2 gap-y-0.5">
              <del className="text-[#F8A5A5]">
                <span className="sr-only">Before: </span>
                {f.before}
              </del>
              <span aria-hidden="true" className="text-chart-text">→</span>
              <ins className="font-semibold text-mint no-underline">
                <span className="sr-only">After: </span>
                {f.after}
              </ins>
            </dd>
          </div>
        ))}
      </dl>

      {error && (
        <p role="alert" className="m-0 rounded-xl bg-red-soft/16 px-3.5 py-2.5 text-[13px] font-medium text-[#FDA4AF]">
          {error}
        </p>
      )}
      <Button variant="teal" size="lg" disabled={busy} onClick={exportData}>
        {busy ? "Preparing export…" : "Export de-identified data"}
      </Button>
      <span className="text-xs text-teal-muted">
        {lastExport ? `Last export ${lastExport} · logged in the audit log` : "No exports yet · every export is logged in the audit log"}
      </span>
    </section>
  );
}
