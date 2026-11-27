"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { gradientFor } from "@/components/ui/Avatar";
import { WarningIcon } from "@/components/ui/icons";
import {
  DISPLAY_FIELDS,
  DOC_KIND_LABELS,
  DOC_KINDS,
  fieldsFromEdit,
  medicationsToText,
  type DisplayId,
  type DocKind,
  type FieldKey,
  type IntakeEdit,
  type IntakeFields,
} from "@/lib/ai/intake-schema";
import { cx } from "@/lib/cx";
import { formatLongDate, initialsOf } from "@/lib/format";
import { approvalFor, flagsFor, flagSummary, type Flag, type PatientMatch } from "@/lib/intake-flags";
import type { DocumentView } from "@/lib/intake-view";

type Values = IntakeEdit["fields"];
type Errors = Partial<Record<FieldKey, string>>;

const DATE_KEYS: FieldKey[] = ["birthDate", "insuranceValidTo", "letterDate"];

function toValues(f: IntakeFields): Values {
  const date = (v: string) => (v ? formatLongDate(v) : "");
  return {
    patientName: f.patientName,
    birthDate: date(f.birthDate),
    insuranceProvider: f.insuranceProvider,
    insuranceMemberId: f.insuranceMemberId,
    insuranceValidTo: date(f.insuranceValidTo),
    medications: medicationsToText(f.medications),
    reasonForVisit: f.reasonForVisit,
    referringDoctor: f.referringDoctor,
    practice: f.practice,
    reasonForReferral: f.reasonForReferral,
    urgency: f.urgency,
    letterDate: date(f.letterDate),
  };
}

const FIELD_STYLES = {
  ok: { border: "border-field-border", bg: "bg-surface" },
  flag: { border: "border-[#F0B44C]", bg: "bg-[#FFFBF2]" },
  missing: { border: "border-[#F3A3A0]", bg: "bg-[#FFF7F7]" },
} as const;

const INPUT =
  "box-border h-[42px] w-full min-w-0 rounded-[11px] border-[1.5px] px-3 font-sans text-sm text-ink outline-none placeholder:text-[#9AA3B8] focus-visible:border-primary disabled:opacity-60";

export type Reviewed = { tone: "success" | "error"; text: string };

/**
 * Right/bottom section: the editable fields, the warning box, the referral match,
 * and Reject / Approve. Edits are saved (never to patients) when a field loses focus;
 * the server sends back the flags and the match, so the match card updates straight away.
 */
export function ExtractedDetails({ view, today, onFocusField, onSaved, onReviewed }: {
  view: DocumentView;
  today: string;
  onFocusField: (id: DisplayId | null) => void;
  onSaved: (view: DocumentView) => void;
  onReviewed: (result: Reviewed) => void;
}) {
  const [kind, setKind] = useState<DocKind>(view.kind);
  const [values, setValues] = useState<Values>(() => toValues(view.extracted.fields));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<"save" | "approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const saved = useRef(JSON.stringify({ kind: view.kind, values: toValues(view.extracted.fields) }));

  // Flags for missing fields follow the typing; the match comes from the last save.
  const local = fieldsFromEdit(values, today);
  const flags = flagsFor(kind, local.fields, today);
  const match = kind === "referral_letter" ? view.match : null;
  const approval = approvalFor(kind, flags, match);
  const summary = flagSummary(kind, flags, local.fields);
  const editable = busy !== "approve" && busy !== "reject";

  async function save(nextKind = kind, nextValues = values, blurred?: FieldKey): Promise<DocumentView | null> {
    const body = { kind: nextKind, fields: nextValues };
    const snapshot = JSON.stringify({ kind: nextKind, values: nextValues });
    if (snapshot === saved.current) return view;
    setBusy("save");
    try {
      const res = await fetch(`/api/intake/${view.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.errors ?? {});
        setError(data.errors ? null : data.error ?? "Couldn't save. Try again.");
        return null;
      }
      const next = data as DocumentView;
      setErrors({});
      setError(null);
      // Tidy the field just saved (e.g. "14/03/1979" → "14 March 1979") if it hasn't changed since.
      const tidy = toValues(next.extracted.fields);
      setValues((v) => (blurred && v[blurred] === nextValues[blurred] ? { ...v, [blurred]: tidy[blurred] } : v));
      saved.current = JSON.stringify({ kind: nextKind, values: blurred ? { ...nextValues, [blurred]: tidy[blurred] } : nextValues });
      onSaved(next);
      return next;
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function review(action: "approve" | "reject") {
    if (action === "approve") {
      // If the name or date of birth changed since the last save, refresh the match first,
      // so the button never does something different from what it says.
      const before = approval.action;
      const latest = await save();
      if (!latest) return;
      if (approvalFor(kind, flags, kind === "referral_letter" ? latest.match : null).action !== before) return;
    }
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/intake/${view.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, kind, fields: values }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.errors ?? {});
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      const name = local.fields.patientName || view.fileName;
      onReviewed(
        action === "reject"
          ? { tone: "success", text: `${DOC_KIND_LABELS[kind]} for ${name} rejected.` }
          : data.created
            ? { tone: "success", text: `${data.name} approved. New patient created, MRN ${data.mrn}.` }
            : { tone: "success", text: `${data.name} approved. Letter attached to MRN ${data.mrn}.` },
      );
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function changeKind(next: DocKind) {
    setKind(next);
    void save(next);
  }

  const set = (key: FieldKey) => (value: string) => setValues((v) => ({ ...v, [key]: value }) as Values);
  const blur = (key: FieldKey) => () => {
    onFocusField(null);
    void save(kind, values, key);
  };
  const focus = (id: DisplayId) => () => onFocusField(id);

  return (
    <section
      aria-labelledby="fields-title"
      className="box-border flex min-w-0 flex-[1.4_1_340px] flex-col gap-3.5 rounded-[22px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft p-5 shadow-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="fields-title" className="m-0 text-base font-bold">
            Extracted details
          </h2>
          <span className="text-[13px] text-secondary">Check each field, fix anything wrong, then approve.</span>
        </div>
        <div role="group" aria-label="Document type" className="flex rounded-xl bg-tab-track p-[3px]">
          {DOC_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              disabled={!editable}
              onClick={() => kind !== k && changeKind(k)}
              className={cx(
                "cursor-pointer rounded-[9px] px-3 py-1.5 font-sans text-xs font-semibold",
                kind === k ? "bg-surface text-ink shadow-tab" : "text-secondary hover:text-ink",
              )}
            >
              {DOC_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {view.extracted.error && (
        <div role="alert" className="flex gap-2.5 rounded-[14px] border border-[#F3A3A0] bg-[#FFF7F7] px-3.5 py-3 text-[13px] leading-[1.45] text-[#B42318]">
          <WarningIcon className="mt-px flex-none" />
          <span>{view.extracted.error}</span>
        </div>
      )}

      {summary && (
        <div role="alert" className="flex gap-2.5 rounded-[14px] border border-[#F6CF85] bg-[#FFF6E5] px-3.5 py-3 text-[13px] leading-[1.45] text-banner-text">
          <WarningIcon className="mt-px flex-none" />
          <span>{summary}</span>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {DISPLAY_FIELDS[kind].map((field) => {
          const flag = flags.find((f) => f.field === field.id);
          const fieldError = field.keys.map((k) => errors[k]).find(Boolean);
          const state = fieldError || flag?.kind === "missing" ? "missing" : flag ? "flag" : "ok";
          const style = FIELD_STYLES[state];
          const inputClass = cx(INPUT, style.border, style.bg);
          const placeholder = state === "missing" && !fieldError ? `Not found in the ${kind === "referral_letter" ? "letter" : "form"}` : "";
          const common = (key: FieldKey) => ({
            value: values[key],
            disabled: !editable,
            onFocus: focus(field.id),
            onBlur: blur(key),
            onChange: (e: { target: { value: string } }) => set(key)(e.target.value),
          });

          return (
            <FieldRow key={field.id} label={field.label} id={`f-${field.id}`} flag={flag} error={fieldError}>
              {field.id === "insurance" ? (
                <div className="flex flex-wrap gap-2">
                  <input id={`f-${field.id}`} aria-label="Insurance provider" placeholder={placeholder || "Provider"} className={cx(inputClass, "flex-[2_1_180px]")} {...common("insuranceProvider")} />
                  <input aria-label="Insurance member ID" placeholder="Member ID" className={cx(inputClass, "flex-[1_1_120px]")} {...common("insuranceMemberId")} />
                  <input aria-label="Insurance valid to" placeholder="Valid to" className={cx(inputClass, "flex-[1_1_140px]")} {...common("insuranceValidTo")} />
                </div>
              ) : field.id === "urgency" ? (
                <select id={`f-${field.id}`} className={cx(inputClass, "cursor-pointer")} {...common("urgency")}>
                  <option value="">Not stated</option>
                  <option value="routine">Routine</option>
                  <option value="soon">Soon</option>
                  <option value="urgent">Urgent</option>
                </select>
              ) : (
                <input
                  id={`f-${field.id}`}
                  type="text"
                  placeholder={field.id === "medications" ? "None" : DATE_KEYS.includes(field.keys[0]) && !placeholder ? "e.g. 14 March 1979" : placeholder}
                  className={inputClass}
                  {...common(field.keys[0])}
                />
              )}
            </FieldRow>
          );
        })}
      </div>

      {kind === "referral_letter" && <MatchCard match={match} name={local.fields.patientName} />}

      {error && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-[#B42318]">
          {error}
        </p>
      )}

      <div className="mt-auto flex gap-2.5 pt-1.5">
        <Button
          variant="secondary"
          size="lg"
          disabled={!editable}
          onClick={() => (confirmReject ? review("reject") : setConfirmReject(true))}
          onBlur={() => setConfirmReject(false)}
          className="flex-none"
        >
          {busy === "reject" ? "Rejecting…" : confirmReject ? "Confirm reject" : "Reject"}
        </Button>
        <Button size="lg" disabled={approval.blocked || !editable} onClick={() => review("approve")} className="flex-1">
          {busy === "approve" ? "Approving…" : approval.label}
        </Button>
      </div>
    </section>
  );
}

function FieldRow({ label, id, flag, error, children }: { label: string; id: string; flag?: Flag; error?: string; children: ReactNode }) {
  const note = error ? { text: error, cls: "text-[#B42318]" } : flag?.kind === "missing" ? { text: "Missing", cls: "text-[#B42318]" } : flag ? { text: "Check this", cls: "text-[#B45309]" } : null;
  return (
    <div className="flex flex-col gap-[5px]">
      <label htmlFor={id} className="flex items-center justify-between gap-2 text-xs font-semibold text-nav-text">
        {label}
        {note && <span className={cx("text-[11px] font-bold", note.cls)}>{note.text}</span>}
      </label>
      {children}
    </div>
  );
}

const MATCH_STYLES = {
  match: { box: "border-[#A7E3C1] bg-[#ECFDF3]", title: "text-[#166534]" },
  none: { box: "border-field-border bg-[#F4F6FB]", title: "text-nav-text" },
  incomplete: { box: "border-field-border bg-[#F4F6FB]", title: "text-nav-text" },
  multiple: { box: "border-[#F6CF85] bg-[#FFF6E5]", title: "text-banner-text" },
} as const;

/** What approving a referral letter will do: attach to a patient, or create one. */
function MatchCard({ match, name }: { match: PatientMatch | null; name: string }) {
  if (!match) return null;
  const typed = name.trim().split(/\s+/);
  const typedInitials = typed.length > 1 ? initialsOf(typed[0], typed[typed.length - 1]) : (typed[0]?.charAt(0).toUpperCase() ?? "?");

  const content =
    match.status === "match"
      ? {
          initials: match.patient.initials,
          avatar: gradientFor(match.patient.initials),
          title: "Matches an existing patient",
          text: `${match.patient.name} · MRN ${match.patient.mrn} · same name and date of birth. The letter will be added to their record.`,
        }
      : match.status === "none"
        ? {
            initials: typedInitials,
            avatar: gradientFor(typedInitials),
            title: "No existing patient found",
            text: "No patient has this name and date of birth. Approving will create a new patient.",
          }
        : match.status === "multiple"
          ? {
              initials: typedInitials,
              avatar: "#D97706",
              title: "More than one patient matches",
              text: `${match.count} patients have this name and date of birth. Ask an admin to check before approving.`,
            }
          : {
              initials: typedInitials || "?",
              avatar: "#9AA3B8",
              title: "Can't check for an existing patient yet",
              text: name.trim()
                ? "A date of birth is needed to match this letter to a record."
                : "A name and date of birth are needed to match this letter to a record.",
            };

  const style = MATCH_STYLES[match.status];
  return (
    <div role="status" className={cx("flex items-center gap-3 rounded-[14px] border px-3.5 py-3", style.box)}>
      <span
        aria-hidden="true"
        style={{ background: content.avatar }}
        className="flex size-9 flex-none items-center justify-center rounded-full text-xs font-bold text-white"
      >
        {content.initials}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cx("text-[13px] font-bold", style.title)}>{content.title}</span>
        <span className="text-xs text-nav-text">{content.text}</span>
      </div>
    </div>
  );
}
