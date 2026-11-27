import { generateText, Output } from "ai";
import {
  ExtractionSchema,
  fieldsFromExtraction,
  type AsWritten,
  type DocKind,
  type IntakeFields,
} from "@/lib/ai/intake-schema";
import { getModel, getModelName } from "@/lib/ai/model";

const PROMPT = `You are reading one scanned or photographed document for a small clinic.
It is either a patient intake form or a referral letter from another doctor.

Rules:
- Copy only what is written on the page. Never guess, infer or fill in a value.
- If a field is missing, blank, crossed out or unreadable, return null for it.
- Never work out a date of birth from an age.
- Write dates as YYYY-MM-DD. Dates on these documents are written day first (14/03/1979 is 14 March 1979).
- Write names as First Last, without titles such as Mr or Mrs.
- Return medications as a list, one medicine per item with its dose. If the patient wrote "none", return an empty list.
- For a referral letter, the reason for referral must be a clinical reason (a symptom, condition, result or question).
  Polite requests such as "please see this patient at your earliest convenience" are not a reason: return null.
- In asWritten, give the exact characters as they appear on the page for each field you found.`;

const TIMEOUT_MS = 55_000;

export type ExtractResult = {
  kind: DocKind;
  fields: IntakeFields;
  asWritten: AsWritten;
  ms: number;
  model: string | null;
};

/** Reads a PDF or image with the configured model and returns the fixed fields. Throws on failure. */
export async function extractIntake(file: { data: Uint8Array; mediaType: string; name: string }): Promise<ExtractResult> {
  const started = performance.now();
  const { output } = await generateText({
    model: getModel(),
    output: Output.object({ schema: ExtractionSchema }),
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "file", data: file.data, mediaType: file.mediaType, filename: file.name },
        ],
      },
    ],
  });
  return {
    kind: output.kind,
    fields: fieldsFromExtraction(output),
    asWritten: output.asWritten,
    ms: Math.round(performance.now() - started),
    model: getModelName() ?? null,
  };
}
