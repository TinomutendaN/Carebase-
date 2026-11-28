import type { ReactNode } from "react";
import { SimulateLabForm } from "@/components/screens/tasks/SimulateLabForm";
import { BoltIcon, LockIcon } from "@/components/ui/icons";
import type { LatestAutoTask } from "@/lib/db/queries/tasks";
import { DUE_AFTER_DAYS } from "@/lib/follow-ups";
import { formatDayMonth } from "@/lib/format";
import { labShortName, labValueText, statusSentence } from "@/lib/lab-display";

const STEP_STYLES = {
  lab: { box: "bg-amber/8 border-amber/35", label: "text-amber-soft" },
  task: { box: "bg-teal/8 border-teal/35", label: "text-mint" },
  assigned: { box: "bg-ai/10 border-ai/40", label: "text-[#C4B5FD]" },
} as const;

function Step({ kind, label, title, sub }: { kind: keyof typeof STEP_STYLES; label: string; title: string; sub: string }) {
  const s = STEP_STYLES[kind];
  return (
    <li className={`flex flex-col gap-1.5 rounded-2xl border p-3.5 ${s.box}`}>
      <span className={`text-[11px] font-bold tracking-[0.1em] ${s.label}`}>{label}</span>
      <span className="text-sm font-bold">{title}</span>
      <span className="text-xs text-[#C9D8DE]">{sub}</span>
    </li>
  );
}

function Connector({ from, to }: { from: string; to: string }) {
  return <li aria-hidden="true" className="h-[18px] w-0.5 self-center" style={{ background: `linear-gradient(${from}, ${to})` }} />;
}

function Flow({ children }: { children: ReactNode }) {
  return <ol className="m-0 flex list-none flex-col gap-1.5 p-0">{children}</ol>;
}

/**
 * The "Automatic follow-ups" panel: how the latest automatic task was made,
 * from lab result to task to assignee. Without lab access (Front Desk) it shows
 * the same flow with no patient or values. With demo tools (Admin) it adds the
 * "Simulate lab result (demo)" form.
 */
export function AutoFollowUps({ latest, showLabs, showDemo }: {
  latest: LatestAutoTask | null;
  showLabs: boolean;
  showDemo: boolean;
}) {
  return (
    <aside
      aria-labelledby="auto-title"
      className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-[26px] border border-mint/14 bg-[radial-gradient(420px_260px_at_50%_30%,rgba(45,212,191,0.18),transparent_70%),linear-gradient(165deg,#0F3142,#0A1C2B)] p-[22px] text-white shadow-[0_28px_70px_rgba(8,30,45,0.35)]"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-linear-145 from-teal to-teal-deep shadow-glow-teal">
          <BoltIcon />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 id="auto-title" className="m-0 text-base font-bold">Automatic follow-ups</h2>
          <span className="text-xs text-teal-muted">Out-of-range lab results create tasks</span>
        </div>
      </div>

      {!showLabs ? (
        <>
          <span className="font-mono text-[11px] tracking-[0.14em] text-mint-label">HOW IT WORKS</span>
          <Flow>
            <Step kind="lab" label="1 · LAB RESULT RECEIVED" title="A result outside its normal range" sub="From the lab, on the patient's record" />
            <Connector from="#FCD34D" to="#2DD4BF" />
            <Step kind="task" label="2 · TASK CREATED" title="A review task, linked to that result" sub="Created automatically" />
            <Connector from="#2DD4BF" to="#8B7BFF" />
            <Step kind="assigned" label="3 · ASSIGNED" title="The clinician" sub={`Due ${DUE_AFTER_DAYS} days after the result`} />
          </Flow>
          <p className="m-0 flex items-center gap-2 text-xs text-teal-muted">
            <LockIcon size={14} className="flex-none text-mint" />
            Lab values are visible to Clinicians and Admins.
          </p>
        </>
      ) : latest ? (
        <>
          <span className="font-mono text-[11px] tracking-[0.14em] text-mint-label">
            LATEST · {formatDayMonth(latest.labDay).toUpperCase()}
          </span>
          <Flow>
            <Step
              kind="lab"
              label="1 · LAB RESULT RECEIVED"
              title={latest.result ? `${labShortName(latest.result.code, latest.result.name)} ${labValueText(latest.result.value, latest.result.unit)}` : "Lab result"}
              sub={
                latest.result
                  ? `${latest.patientName} · ${lowerFirst(statusSentence(latest.result.code, latest.result.value, latest.result.low, latest.result.high, latest.result.unit))}`
                  : latest.patientName
              }
            />
            <Connector from="#FCD34D" to="#2DD4BF" />
            <Step kind="task" label="2 · TASK CREATED" title={latest.title} sub={`Linked to the lab result on ${firstName(latest.patientName)}'s record`} />
            <Connector from="#2DD4BF" to="#8B7BFF" />
            <Step
              kind="assigned"
              label="3 · ASSIGNED"
              title={latest.assigneeName}
              sub={`Due ${formatDayMonth(latest.dueOn)} · ${DUE_AFTER_DAYS} days after the result`}
            />
          </Flow>
        </>
      ) : (
        <p className="m-0 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-[13px] text-[#C9D8DE]">
          No automatic tasks yet. One appears here when a lab result comes back outside its normal range.
        </p>
      )}

      <p className="m-0 text-xs leading-[1.55] text-teal-muted">
        No one has to spot the result by hand. Each task links back to the exact lab result that created it.
      </p>

      {showDemo && <SimulateLabForm />}
    </aside>
  );
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function firstName(name: string): string {
  return name.split(" ")[0];
}
