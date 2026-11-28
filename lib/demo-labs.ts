import { labRange } from "@/lib/lab-ranges";

/** The labs offered by "Simulate lab result (demo)" on the Tasks screen. */
export const DEMO_LABS = [
  { code: "4548-4", name: "HbA1c", unit: "%" },
  { code: "2339-0", name: "Glucose", unit: "mg/dL" },
  { code: "18262-6", name: "LDL", unit: "mg/dL" },
  { code: "6298-4", name: "Potassium", unit: "mmol/L" },
  { code: "2160-0", name: "Creatinine", unit: "mg/dL" },
].map((lab) => ({ ...lab, range: labRange(lab.code)! }));
