import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import { ExternalLinkIcon, ShieldIcon } from "@/components/ui/icons";
import { viewAnswer, type SourceChip } from "@/lib/ai/sources";

const CHIP =
  "inline-flex items-center gap-1.5 rounded-[9px] border border-teal/35 bg-teal/14 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-[#99F6E4] no-underline hover:bg-teal/22";

/** The question, right-aligned in the blue bubble. */
export function UserBubble({ text }: { text: string }) {
  return (
    <div className="max-w-[88%] self-end rounded-[16px_16px_4px_16px] bg-linear-145 from-[#4C72F0] to-[#2F55E0] px-3.5 py-3 text-sm leading-normal break-words whitespace-pre-wrap">
      {text}
    </div>
  );
}

/** One answer: its text and source chips, or the declined card. */
export function AnswerBubble({ message, streaming, onSource }: {
  message: UIMessage;
  streaming: boolean;
  onSource: (chip: SourceChip) => void;
}) {
  const view = viewAnswer(message, { streaming });

  if (view.declined) return <DeclinedCard text={view.declined} />;

  const empty = view.paragraphs.length === 0;
  if (empty && !streaming) {
    return (
      <AnswerShell>
        <p className="m-0 text-sm leading-relaxed text-lavender">No answer came back. Please ask again.</p>
      </AnswerShell>
    );
  }

  return (
    <AnswerShell>
      {view.paragraphs.map((p, i) => (
        <p key={i} className="m-0 text-sm leading-relaxed">
          {p}
        </p>
      ))}
      {streaming && (empty || view.status) && <StatusLine text={view.status ?? "Thinking…"} />}
      {view.sources.length > 0 && !streaming && (
        <>
          <span className="text-[11px] font-bold tracking-[0.1em] text-lavender">SOURCES</span>
          <div className="flex flex-wrap gap-1.5">
            {view.sources.map((chip) => (
              <SourceLink key={chip.ref} chip={chip} onSource={onSource} />
            ))}
          </div>
        </>
      )}
    </AnswerShell>
  );
}

function AnswerShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[16px_16px_16px_4px] border border-white/10 bg-white/7 p-3.5">{children}</div>
  );
}

/** Waiting for the first answer, before any message has arrived. */
export function PendingBubble() {
  return (
    <AnswerShell>
      <StatusLine text="Thinking…" />
    </AnswerShell>
  );
}

function StatusLine({ text }: { text: string }) {
  return (
    <span role="status" className="flex items-center gap-2 text-[13px] text-lavender">
      <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-mint" />
      {text}
    </span>
  );
}

/** Refusals: amber card with the DECLINED pill (designs/source/03-patient.html). */
function DeclinedCard({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[16px_16px_16px_4px] border border-amber/35 bg-amber/8 p-3.5">
      <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-amber/16 px-2.5 py-[3px] text-[11px] font-bold tracking-[0.06em] text-amber-soft">
        <ShieldIcon />
        DECLINED
      </span>
      <p className="m-0 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

/** Error from the API (daily cap, role, network): shown in the answer's place. */
export function ErrorBubble({ text }: { text: string }) {
  return (
    <div role="alert" className="rounded-[16px_16px_16px_4px] border border-red-soft/40 bg-red/10 p-3.5 text-sm leading-relaxed">
      {text}
    </div>
  );
}

function SourceLink({ chip, onSource }: { chip: SourceChip; onSource: (chip: SourceChip) => void }) {
  if (chip.target.kind === "url") {
    return (
      <a href={chip.target.url} target="_blank" rel="noopener noreferrer" className={CHIP} title={`Open ${chip.label} in a new tab`}>
        {chip.label}
        <ExternalLinkIcon />
      </a>
    );
  }
  return (
    <a
      href={`#${chip.target.anchor}`}
      className={CHIP}
      onClick={(e) => {
        e.preventDefault();
        onSource(chip);
      }}
    >
      {chip.label}
    </a>
  );
}
