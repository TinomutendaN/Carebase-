"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { SparkleIcon } from "@/components/ui/icons";
import type { SourceChip } from "@/lib/ai/sources";
import { focusRecord } from "@/lib/record-focus";
import { AssistantPanel } from "./AssistantPanel";

/** The API's { error } text, or a general message (network failures, timeouts). */
function errorText(error: Error | undefined): string | null {
  if (!error) return null;
  try {
    const body = JSON.parse(error.message) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // Not JSON: fall through.
  }
  return "The assistant couldn't answer just now. Please try again.";
}

/**
 * "Ask assistant" and the floating panel, for roles with the assistant
 * (the page doesn't render this for Front Desk). The server fixes the patient:
 * this only says which page is open, and /api/assistant checks it again.
 */
export function Assistant({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [open, setOpen] = useState(false);
  // The panel mounts on first open and then stays, so its place and the chat survive closing.
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/assistant", body: { patientId } }));
  const { messages, sendMessage, status, error } = useChat({ transport });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function show() {
    setMounted(true);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  /** A source chip: hide the panel (the chat is kept) so the record it points to can be seen. */
  function openSource(chip: SourceChip) {
    if (chip.target.kind === "url") return;
    setOpen(false);
    const { anchor } = chip.target;
    const code = chip.target.kind === "lab" ? chip.target.code : undefined;
    history.replaceState(null, "", `#${anchor}`);
    requestAnimationFrame(() => focusRecord(anchor, code));
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={show}
        aria-expanded={open}
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-[13px] border-none bg-linear-145 from-[#5B7BFF] to-[#2F55E0] px-[18px] text-sm font-bold text-white shadow-[0_10px_24px_rgba(47,85,224,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-105"
      >
        <SparkleIcon />
        Ask assistant
      </button>

      {open && (
        <button
          type="button"
          aria-label="Close assistant"
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-40 cursor-pointer border-none bg-[rgba(15,23,42,0.28)] p-0 backdrop-blur-[2px]"
        />
      )}
      {mounted && (
        <AssistantPanel
          patientName={patientName}
          hidden={!open}
          messages={messages}
          status={status}
          error={errorText(error)}
          inputRef={inputRef}
          onSend={(text) => void sendMessage({ text })}
          onClose={close}
          onSource={openSource}
        />
      )}
    </>
  );
}
