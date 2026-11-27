"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DocumentPreview, ReadingPreview } from "@/components/screens/intake/DocumentPreview";
import { ACCEPT, DocumentQueue, MAX_BYTES } from "@/components/screens/intake/DocumentQueue";
import { ExtractedDetails, type Reviewed } from "@/components/screens/intake/ExtractedDetails";
import type { DisplayId } from "@/lib/ai/intake-schema";
import type { ApprovedItem, QueueItem } from "@/lib/db/queries/intake";
import type { DocumentView } from "@/lib/intake-view";

type Reading = { name: string; url: string | null; isImage: boolean };

/**
 * The Intake review screen (designs/04-intake.png): queue, document preview and
 * extracted details. The server sends the selected document; this keeps the
 * upload state and the latest saved version of the document between refreshes.
 */
export function IntakeReview({ queue, approved, view, today }: {
  queue: QueueItem[];
  approved: ApprovedItem[];
  view: DocumentView | null;
  today: string;
}) {
  const router = useRouter();
  const [reading, setReading] = useState<Reading | null>(null);
  const [notice, setNotice] = useState<Reviewed | null>(null);
  const [activeField, setActiveField] = useState<DisplayId | null>(null);
  // The PATCH response, used until the server sends a newer page.
  const [saved, setSaved] = useState<{ base: DocumentView | null; view: DocumentView } | null>(null);
  const current = saved && saved.base === view ? saved.view : view;

  useEffect(() => () => {
    if (reading?.url) URL.revokeObjectURL(reading.url);
  }, [reading]);

  function select(id: string) {
    setNotice(null);
    router.push(`/intake?doc=${id}`, { scroll: false });
  }

  async function upload(file: File) {
    setNotice(null);
    if (!ACCEPT.split(",").includes(file.type)) return setNotice({ tone: "error", text: "Upload a PDF, JPG or PNG." });
    if (file.size > MAX_BYTES) return setNotice({ tone: "error", text: "Files can be up to 4 MB." });

    const isImage = file.type.startsWith("image/");
    setReading({ name: file.name, url: isImage ? URL.createObjectURL(file) : null, isImage });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/intake", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ tone: "error", text: data.error ?? "Upload failed. Try again." });
        return;
      }
      router.push(`/intake?doc=${data.id}`, { scroll: false });
      router.refresh();
    } catch {
      setNotice({ tone: "error", text: "Upload failed. Check your connection and try again." });
    } finally {
      setReading(null);
    }
  }

  function reviewed(result: Reviewed) {
    setNotice(result);
    router.push("/intake", { scroll: false });
    router.refresh();
  }

  return (
    <div className="box-border flex flex-wrap items-stretch gap-5 px-8 pt-6 pb-9 max-sm:px-4">
      <DocumentQueue
        queue={queue}
        approved={approved}
        selectedId={reading ? null : current?.id ?? null}
        reading={reading?.name ?? null}
        notice={notice}
        onUpload={upload}
        onSelect={select}
      />

      {reading ? (
        <>
          <ReadingPreview fileName={reading.name} url={reading.url} isImage={reading.isImage} />
          <section
            aria-label="Extracted details"
            aria-busy="true"
            className="box-border flex min-h-[240px] min-w-0 basis-full items-center justify-center rounded-[22px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft p-5 text-sm text-secondary shadow-card"
          >
            Reading document… the fields appear here when the AI is done.
          </section>
        </>
      ) : current ? (
        <>
          <DocumentPreview key={`p-${current.id}`} view={current} activeField={activeField} />
          <ExtractedDetails
            key={current.id}
            view={current}
            today={today}
            onFocusField={setActiveField}
            onSaved={(next) => {
              setSaved({ base: view, view: next });
              router.refresh();
            }}
            onReviewed={reviewed}
          />
        </>
      ) : (
        <section className="box-border flex min-h-[320px] min-w-0 flex-[2_1_380px] flex-col items-center justify-center gap-2 rounded-[26px] border border-mint/15 bg-[radial-gradient(500px_300px_at_50%_40%,rgba(45,212,191,0.16),transparent_70%),linear-gradient(165deg,#0F3142,#0A1C2B)] p-6 text-center text-white shadow-panel-teal">
          <h2 className="m-0 text-base font-bold">Nothing waiting for review</h2>
          <p className="m-0 max-w-[340px] text-[13px] text-teal-muted">Upload an intake form or referral letter, and the AI will read it for you to check.</p>
        </section>
      )}
    </div>
  );
}
