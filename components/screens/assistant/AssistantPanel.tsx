"use client";

import type { ChatStatus, UIMessage } from "ai";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { ArrowRightIcon, CloseIcon, GripIcon, SparkleIcon } from "@/components/ui/icons";
import { IconChip } from "@/components/ui/IconChip";
import { MAX_QUESTION_CHARS } from "@/lib/ai/limits";
import type { SourceChip } from "@/lib/ai/sources";
import { cx } from "@/lib/cx";
import { AnswerBubble, ErrorBubble, PendingBubble, UserBubble } from "./AssistantMessage";

/** How far one arrow-key press moves the panel. */
const KEY_STEP = 24;
/** Space kept between the panel and the window edge. */
const EDGE = 8;

type Offset = { dx: number; dy: number };

type Props = {
  patientName: string;
  hidden: boolean;
  messages: UIMessage[];
  status: ChatStatus;
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onSend: (text: string) => void;
  onClose: () => void;
  onSource: (chip: SourceChip) => void;
};

/**
 * The floating assistant (designs/03-patient-assistant-open.png). Drag it by its
 * header, or move it with the arrow keys on the grip button. It stays on screen.
 */
export function AssistantPanel({ patientName, hidden, messages, status, error, inputRef, onSend, onClose, onSource }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<Offset>({ dx: 0, dy: 0 });
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState("");
  const busy = status === "submitted" || status === "streaming";

  /** Move by (x, y) from `from`, keeping the whole panel inside the window. */
  function clamp(from: Offset, x: number, y: number, rect: DOMRect): Offset {
    const dx = Math.min(Math.max(x, EDGE - rect.left), window.innerWidth - EDGE - rect.right);
    const dy = Math.min(Math.max(y, EDGE - rect.top), window.innerHeight - EDGE - rect.bottom);
    return { dx: from.dx + dx, dy: from.dy + dy };
  }

  function startDrag(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !panelRef.current) return;
    // The close button doesn't start a drag; the grip button (which has a title) does.
    if ((e.target as HTMLElement).closest("button:not([title])")) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const from = offset;
    const rect = panelRef.current.getBoundingClientRect();
    const move = (ev: globalThis.PointerEvent) => setOffset(clamp(from, ev.clientX - start.x, ev.clientY - start.y, rect));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    setDragging(true);
  }

  function keyMove(e: KeyboardEvent<HTMLButtonElement>) {
    const step = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] }[e.key];
    if (!step || !panelRef.current) return;
    e.preventDefault();
    setOffset(clamp(offset, step[0], step[1], panelRef.current.getBoundingClientRect()));
  }

  // Keep the newest message in view while answers stream in.
  const last = messages.at(-1);
  const lastLength = last?.parts.reduce((n, p) => n + (p.type === "text" ? p.text.length : 1), 0) ?? 0;
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, lastLength, status, error]);

  function submit() {
    const question = text.trim();
    if (!question || busy) return;
    onSend(question);
    setText("");
  }

  return (
    <aside
      ref={panelRef}
      hidden={hidden}
      aria-labelledby="ai-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      style={{ transform: `translate(${offset.dx}px, ${offset.dy}px)` }}
      className={cx(
        "on-dark fixed top-6 right-6 z-50 box-border flex h-[min(calc(100vh-48px),820px)] w-[440px] max-w-[calc(100%-24px)] flex-col gap-4 rounded-[26px] border border-white/8 p-5 text-white shadow-[-30px_0_80px_rgba(30,26,90,0.45)]",
        "bg-[radial-gradient(420px_240px_at_100%_0%,rgba(124,92,255,0.4),transparent_70%),radial-gradient(360px_220px_at_0%_100%,rgba(45,212,191,0.18),transparent_70%),linear-gradient(170deg,#25216A,#15163F)]",
        "max-sm:top-3 max-sm:right-3 max-sm:h-[calc(100vh-24px)] max-sm:p-4",
        dragging ? "transition-none" : "transition-transform duration-150 ease-out",
      )}
    >
      <div
        onPointerDown={startDrag}
        className={cx("flex touch-none items-center gap-3 select-none", dragging ? "cursor-grabbing" : "cursor-grab")}
      >
        <IconChip color="ai" size={40}>
          <SparkleIcon size={18} />
        </IconChip>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="ai-title" className="m-0 text-base font-bold">
            Assistant
          </h2>
          <span className="text-xs text-lavender">Answers about {patientName} only, with sources</span>
        </div>
        <button
          type="button"
          onKeyDown={keyMove}
          aria-label="Move assistant. Drag, or use the arrow keys."
          title="Drag to move"
          className={cx(
            "ml-auto flex size-10 flex-none touch-none items-center justify-center rounded-[11px] border border-white/16 bg-white/6 text-lavender",
            dragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          <GripIcon />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          className="flex size-10 flex-none cursor-pointer items-center justify-center rounded-[11px] border border-white/16 bg-white/6 text-white hover:bg-white/12"
        >
          <CloseIcon />
        </button>
      </div>

      <div ref={listRef} aria-live="polite" className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
        {messages.length === 0 && (
          <p className="m-0 text-[13px] leading-relaxed text-lavender">
            Ask about {patientName}&apos;s labs, medications, wearables, conditions or allergies.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <UserBubble key={m.id} text={m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")} />
          ) : (
            <AnswerBubble key={m.id} message={m} streaming={busy && i === messages.length - 1} onSource={onSource} />
          ),
        )}
        {status === "submitted" && last?.role === "user" && <PendingBubble />}
        {error && <ErrorBubble text={error} />}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex min-h-[50px] items-center gap-2.5 rounded-[14px] border border-white/14 bg-white/8 py-0 pr-1.5 pl-3.5 focus-within:border-white/30"
      >
        <label htmlFor="ai-question" className="sr-only">
          Ask about this patient
        </label>
        <input
          ref={inputRef}
          id="ai-question"
          type="text"
          autoComplete="off"
          maxLength={MAX_QUESTION_CHARS}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about this patient…"
          className="min-w-0 flex-1 border-none bg-transparent text-sm text-white outline-none placeholder:text-white/45 focus-visible:shadow-none focus-visible:outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={busy || !text.trim()}
          className="flex size-10 flex-none cursor-pointer items-center justify-center rounded-[11px] bg-linear-145 from-teal to-teal-deep text-teal-on shadow-[0_0_18px_rgba(45,212,191,0.45)] disabled:cursor-default disabled:opacity-55"
        >
          <ArrowRightIcon size={16} strokeWidth={2.4} />
        </button>
      </form>
    </aside>
  );
}
