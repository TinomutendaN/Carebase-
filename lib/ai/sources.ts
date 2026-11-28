import type { UIMessage } from "ai";
import type {
  AssistantAllergy,
  AssistantCondition,
  AssistantLab,
  AssistantMedication,
  WearablesResult,
} from "@/lib/db/queries/assistant";
import { formatDate, formatDayMonth } from "@/lib/format";

/**
 * Turns an assistant answer into what the panel shows: the text with its [ref]
 * citations taken out, and a source chip for each cited record. A chip is made
 * only for a ref that appears in this answer's own tool results, so a ref the
 * model invents is dropped and never becomes a link. Labels come from the tool
 * data, never from the model's text. Shared with the Step 9 tests.
 */

export type SourceTarget =
  /** A lab result: the timeline row lab-<id>, or the lab chart for its code. */
  | { kind: "lab"; anchor: string; code: string }
  /** A row or card on the Patient page. */
  | { kind: "anchor"; anchor: string }
  /** A public health page, opened in a new tab. */
  | { kind: "url"; url: string };

export type SourceChip = { ref: string; label: string; target: SourceTarget };

export type AnswerView = {
  /** Paragraphs with the citations removed. */
  paragraphs: string[];
  sources: SourceChip[];
  /** Set when the assistant declined: the fixed wording. */
  declined: string | null;
  /** While streaming: what the assistant is reading, e.g. "Reading lab results…". */
  status: string | null;
  /** Refs the model cited that no tool returned (kept for the tests). */
  unknownRefs: string[];
};

const REF = "(?:lab|med|cond|allergy|wearable|evidence)-[\\w]+";
/** "[lab-2066]", "[lab-2066, lab-2051]" or "[lab-2066; evidence-12]". */
const CITATION = new RegExp(`\\s*\\[(${REF}(?:\\s*[,;]\\s*${REF})*)\\]`, "g");

const STATUS: Record<string, string> = {
  getLabs: "Reading lab results…",
  getWearables: "Reading wearable data…",
  getMedications: "Reading medications…",
  getConditions: "Reading conditions…",
  getAllergies: "Reading allergies…",
  searchHealthLibrary: "Searching the health library…",
};

type ToolPart = { type: string; state?: string; output?: unknown };

const PUBLISHERS: [RegExp, string][] = [
  [/niddk\.nih\.gov/, "NIDDK"],
  [/nhlbi\.nih\.gov/, "NHLBI"],
  [/medlineplus\.gov/, "MedlinePlus"],
];

function shorten(text: string, max = 30): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** "27 Nov" this year, "21 Nov 2025" otherwise. */
function chipDate(date: string, thisYear: number): string {
  return Number(date.slice(0, 4)) === thisYear ? formatDayMonth(date) : formatDate(date);
}

/** "amLODIPine 2.5 MG Oral Tablet" → "amLODIPine" */
function medShortName(name: string): string {
  return name.split(/\s+\d/)[0].trim() || name;
}

/** Every record the tools returned in this answer, by ref. */
function collectSources(parts: ToolPart[], thisYear: number): Map<string, SourceChip> {
  const found = new Map<string, SourceChip>();
  const add = (chip: SourceChip) => {
    if (!found.has(chip.ref)) found.set(chip.ref, chip);
  };
  for (const part of parts) {
    if (part.state !== "output-available" || !part.output || typeof part.output !== "object") continue;
    const out = part.output as Record<string, unknown>;
    switch (part.type) {
      case "tool-getLabs":
        for (const r of (out.results as AssistantLab[] | undefined) ?? []) {
          add({ ref: r.ref, label: `${r.name} · ${chipDate(r.date, thisYear)}`, target: { kind: "lab", anchor: r.ref, code: r.code } });
        }
        break;
      case "tool-getMedications":
        for (const m of (out.medications as AssistantMedication[] | undefined) ?? []) {
          add({ ref: m.ref, label: `Med · ${shorten(medShortName(m.name), 24)}`, target: { kind: "anchor", anchor: `med-start-${m.ref.slice(4)}` } });
        }
        break;
      case "tool-getConditions":
        for (const c of (out.conditions as AssistantCondition[] | undefined) ?? []) {
          add({ ref: c.ref, label: `Condition · ${shorten(c.name, 26)}`, target: { kind: "anchor", anchor: "conditions" } });
        }
        break;
      case "tool-getAllergies":
        for (const a of (out.allergies as AssistantAllergy[] | undefined) ?? []) {
          add({ ref: a.ref, label: `Allergy · ${shorten(a.substance, 26)}`, target: { kind: "anchor", anchor: "allergies" } });
        }
        break;
      case "tool-getWearables":
        for (const w of (out.wearables as WearablesResult | undefined) ?? []) {
          add({ ref: w.ref, label: `${w.label} · ${w.readings.length} days`, target: { kind: "anchor", anchor: "wearables" } });
        }
        break;
      case "tool-searchHealthLibrary":
        for (const s of (out.sources as { ref: string; title: string; url: string }[] | undefined) ?? []) {
          const publisher = PUBLISHERS.find(([re]) => re.test(s.url))?.[1] ?? "Source";
          add({ ref: s.ref, label: `${publisher} · ${shorten(s.title, 28)}`, target: { kind: "url", url: s.url } });
        }
        break;
    }
  }
  return found;
}

export function viewAnswer(message: UIMessage, { streaming, thisYear = new Date().getFullYear() }: { streaming: boolean; thisYear?: number }): AnswerView {
  const parts = message.parts as ToolPart[];
  const decline = parts.find((p) => p.type === "tool-decline" && p.state === "output-available");
  const declined = (decline?.output as { message?: string } | undefined)?.message ?? null;

  const known = collectSources(parts, thisYear);
  const cited: string[] = [];
  const unknownRefs: string[] = [];

  const raw = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const text = raw
    .replace(CITATION, (_, list: string) => {
      for (const ref of list.split(/\s*[,;]\s*/)) {
        if (known.has(ref)) {
          if (!cited.includes(ref)) cited.push(ref);
        } else if (!unknownRefs.includes(ref)) {
          unknownRefs.push(ref);
        }
      }
      return "";
    })
    // A citation still streaming in, e.g. "[lab-20", isn't shown.
    .replace(/\s*\[[a-z]*-?[\w,; -]*$/, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/ +([.,;:])/g, "$1");

  // Evidence chunks from the same page share one chip.
  const sources: SourceChip[] = [];
  for (const ref of cited) {
    const chip = known.get(ref)!;
    if (chip.target.kind === "url" && sources.some((s) => s.target.kind === "url" && s.target.url === (chip.target as { url: string }).url)) continue;
    sources.push(chip);
  }

  const pending = [...parts].reverse().find((p) => p.type.startsWith("tool-") && p.state !== "output-available" && p.state !== "output-error");
  const status = streaming && pending ? (STATUS[pending.type.slice(5)] ?? null) : null;

  return {
    paragraphs: text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    sources,
    declined,
    status,
    unknownRefs,
  };
}
