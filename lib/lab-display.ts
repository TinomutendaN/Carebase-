import { DEFAULT_DECIMALS, LAB_RANGES } from "@/lib/lab-ranges";

/**
 * Short, readable names and range text for lab results. Synthea stores LOINC
 * long names ("Hemoglobin A1c/Hemoglobin.total in Blood"); screens show these instead.
 */

/** The three labs the switcher prefers, in order. Glucose has a blood and a serum code. */
export const MAIN_LAB_GROUPS: string[][] = [["4548-4"], ["2339-0", "2345-7"], ["18262-6"]];

const SHORT_NAMES: Record<string, string> = {
  "4548-4": "HbA1c",
  "2339-0": "Glucose",
  "2345-7": "Glucose",
  "18262-6": "LDL",
  "2093-3": "Total cholesterol",
  "2085-9": "HDL",
  "2571-8": "Triglycerides",
  "20565-8": "Carbon dioxide",
  "2028-9": "Carbon dioxide",
  "33914-3": "eGFR",
  "14959-1": "Microalbumin/creatinine",
  "32623-1": "Mean platelet volume",
  "32207-3": "Platelet distribution width",
  "788-0": "Red cell distribution width",
  "789-8": "Red cells",
  "6690-2": "White cells",
  "777-3": "Platelets",
  "4544-3": "Hematocrit",
  "6299-2": "Urea nitrogen",
  "3094-0": "Urea nitrogen",
  "5811-5": "Urine specific gravity",
  "5803-2": "Urine pH",
  "5792-7": "Urine glucose",
  "5804-0": "Urine protein",
  "5797-6": "Urine ketones",
};

/** "HbA1c", or the long name cut before its first bracket ("Sodium [Moles/volume] in Blood" → "Sodium"). */
export function labShortName(code: string, name: string): string {
  return SHORT_NAMES[code] ?? name.split(" [")[0].split(" in ")[0].trim();
}

function fmt(code: string, value: number): string {
  const decimals = LAB_RANGES[code]?.decimals ?? DEFAULT_DECIMALS;
  return value.toFixed(decimals);
}

/** "4.0–5.6%", "under 100 mg/dL", "over 40 mg/dL", or null with no range. */
export function rangeText(code: string, low: number | null, high: number | null, unit: string): string | null {
  const u = unit === "%" ? "%" : ` ${unit}`;
  if (low != null && high != null) return `${fmt(code, low)}–${fmt(code, high)}${u}`;
  if (high != null) return `under ${fmt(code, high)}${u}`;
  if (low != null) return `over ${fmt(code, low)}${u}`;
  return null;
}

/** The chart's right-hand caption: "Normal range 4.0–5.6%" or "Target under 100 mg/dL". */
export function rangeCaption(code: string, low: number | null, high: number | null, unit: string): string {
  const text = rangeText(code, low, high, unit);
  if (!text) return "No reference range";
  return low != null && high != null ? `Normal range ${text}` : `Target ${text}`;
}

export type LabStatus = "in" | "above" | "below" | "none";

export function labStatus(value: number, low: number | null, high: number | null): LabStatus {
  if (low == null && high == null) return "none";
  if (high != null && value > high) return "above";
  if (low != null && value < low) return "below";
  return "in";
}

/** "Above normal range (4.0–5.6%)" for timeline rows. */
export function statusSentence(code: string, value: number, low: number | null, high: number | null, unit: string): string {
  const text = rangeText(code, low, high, unit);
  if (!text) return "No reference range";
  const status = labStatus(value, low, high);
  const lead = status === "above" ? "Above normal range" : status === "below" ? "Below normal range" : "Within normal range";
  return `${lead} (${text})`;
}

/** "7.3%", "3.1 mmol/L"; units in braces ("{nominal}") are left off. For task text. */
export function labValueText(value: number, unit: string): string {
  if (unit === "%") return `${value}%`;
  if (!unit || unit.startsWith("{")) return String(value);
  return `${value} ${unit}`;
}

/** "7.3 %" or "130 mg/dL", the value as stored. */
export function formatLabValue(value: number, unit: string): string {
  return `${value} ${unit}`;
}
