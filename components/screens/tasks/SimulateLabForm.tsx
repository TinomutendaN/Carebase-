"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DEMO_LABS } from "@/lib/demo-labs";
import { rangeText } from "@/lib/lab-display";

const FIELD =
  "box-border h-10 w-full min-w-0 rounded-[10px] border border-white/15 bg-white/8 px-3 font-sans text-[13px] text-white outline-none placeholder:text-teal-muted/70 focus:border-mint";

/**
 * "Simulate lab result (demo)", Admin only (demo_tools). Adds a lab result
 * through POST /api/demo/lab-result, which runs the same follow-up rule as a
 * real lab feed, then refreshes so the panel and the list show the new task.
 */
export function SimulateLabForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mrn, setMrn] = useState("");
  const [code, setCode] = useState(DEMO_LABS[0].code);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const lab = DEMO_LABS.find((l) => l.code === code) ?? DEMO_LABS[0];
  const normal = rangeText(lab.code, lab.range.low, lab.range.high, lab.unit);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/demo/lab-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mrn: mrn.trim(), code, value: Number(value) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "The result couldn't be added. Try again.");
      setMessage({ ok: true, text: body.message });
      setValue("");
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "The result couldn't be added. Try again." });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer self-start border-none bg-transparent p-0 font-sans text-xs font-semibold text-mint underline decoration-mint/40 underline-offset-4"
      >
        Simulate lab result (demo)
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] tracking-[0.14em] text-mint-label">DEMO LAB RESULT</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="cursor-pointer border-none bg-transparent p-0 font-sans text-xs font-semibold text-teal-muted"
        >
          Close
        </button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(90px,1fr))] gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-teal-muted">
          Patient MRN
          <input className={FIELD} value={mrn} onChange={(e) => setMrn(e.target.value)} placeholder="e.g. 28910" required inputMode="numeric" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-teal-muted">
          Lab
          <select className={FIELD} value={code} onChange={(e) => setCode(e.target.value)}>
            {DEMO_LABS.map((l) => (
              <option key={l.code} value={l.code} className="text-ink">
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-teal-muted">
          Value ({lab.unit})
          <input
            className={FIELD}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type="number"
            step="any"
            min="0"
            required
          />
        </label>
      </div>
      {normal && <span className="text-[11px] text-teal-muted">Normal range {normal}</span>}
      <button
        type="submit"
        disabled={busy}
        className="min-h-10 cursor-pointer rounded-[11px] border-none bg-linear-145 from-teal to-teal-deep font-sans text-[13px] font-bold text-teal-on disabled:cursor-default disabled:opacity-60"
      >
        {busy ? "Adding…" : "Add result"}
      </button>
      {message && (
        <p role="status" className={`m-0 text-xs ${message.ok ? "text-mint" : "text-[#FDA4AF]"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
