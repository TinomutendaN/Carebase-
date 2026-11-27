/**
 * Normal ranges for the lab codes (LOINC) we import, in the units Synthea uses.
 * A result is out of range when it is below `low` or above `high`; null means no limit on that side.
 * `decimals` is how many decimal places a value is rounded to when it's stored.
 * Codes not listed here are stored with no range (see the Step 3 report for why).
 */
export type LabRange = { low: number | null; high: number | null; decimals: number };

const range = (low: number | null, high: number | null, decimals = 1): LabRange => ({ low, high, decimals });

export const LAB_RANGES: Record<string, LabRange> = {
  // Diabetes and lipids
  "4548-4": range(4.0, 5.6), // HbA1c, %
  "2339-0": range(70, 99, 0), // Glucose, blood, mg/dL
  "2345-7": range(70, 99, 0), // Glucose, serum or plasma, mg/dL
  "18262-6": range(null, 100, 0), // LDL cholesterol, mg/dL
  "2093-3": range(null, 200, 0), // Total cholesterol, mg/dL
  "2571-8": range(null, 150, 0), // Triglycerides, mg/dL
  "2085-9": range(40, null, 0), // HDL cholesterol, mg/dL

  // Metabolic panel (blood code, then serum or plasma code)
  "6299-2": range(7, 20), // Urea nitrogen, mg/dL
  "3094-0": range(7, 20),
  "38483-4": range(0.6, 1.3, 2), // Creatinine, mg/dL
  "2160-0": range(0.6, 1.3, 2),
  "49765-1": range(8.5, 10.2), // Calcium, mg/dL
  "17861-6": range(8.5, 10.2),
  "2947-0": range(135, 145), // Sodium, mmol/L
  "2951-2": range(135, 145),
  "6298-4": range(3.5, 5.1), // Potassium, mmol/L
  "2823-3": range(3.5, 5.1),
  "2069-3": range(98, 107), // Chloride, mmol/L
  "2075-0": range(98, 107),
  "20565-8": range(22, 29), // Carbon dioxide, total, mmol/L
  "2028-9": range(22, 29),
  "33914-3": range(60, null), // eGFR, mL/min/1.73 m2
  "19123-9": range(1.7, 2.2), // Magnesium, serum, mg/dL
  "21377-7": range(1.7, 2.2), // Magnesium, blood, mg/dL
  "2777-1": range(2.5, 4.5), // Phosphate, mg/dL

  // Kidney (urine)
  "14959-1": range(null, 30), // Microalbumin/creatinine ratio, mg/g

  // Liver panel
  "2885-2": range(6.0, 8.3), // Total protein, g/dL
  "1751-7": range(3.5, 5.0), // Albumin, g/dL
  "1975-2": range(0.1, 1.2, 2), // Bilirubin total, serum, mg/dL
  "6768-6": range(44, 147), // Alkaline phosphatase, U/L
  "1742-6": range(7, 56), // ALT, U/L
  "1920-8": range(10, 40), // AST, U/L

  // Complete blood count
  "6690-2": range(4.5, 11.0), // White cells, 10*3/uL
  "789-8": range(4.2, 5.9, 2), // Red cells, 10*6/uL
  "718-7": range(12.0, 17.5), // Hemoglobin, g/dL
  "4544-3": range(36, 50), // Hematocrit, %
  "787-2": range(80, 100), // MCV, fL
  "785-6": range(27, 33), // MCH, pg
  "786-4": range(32, 36), // MCHC, g/dL
  "777-3": range(150, 400, 0), // Platelets, 10*3/uL
  "32623-1": range(7.5, 11.5), // Mean platelet volume, fL

  // White cell differential, % of white cells
  "770-8": range(40, 70), // Neutrophils
  "736-9": range(20, 40), // Lymphocytes
  "5905-5": range(2, 8), // Monocytes
  "713-8": range(1, 4), // Eosinophils
  "706-2": range(0.5, 1.0), // Basophils

  // White cell differential, absolute counts, 10*3/uL
  "751-8": range(1.5, 8.0, 2), // Neutrophils
  "731-0": range(1.0, 4.8, 2), // Lymphocytes
  "742-7": range(0.2, 0.8, 2), // Monocytes
  "711-2": range(0, 0.5, 2), // Eosinophils
  "704-7": range(0, 0.2, 2), // Basophils

  // Coagulation (PT is deliberately left out: Synthea's values all sit below the standard range)
  "6301-6": range(0.8, 1.2, 2), // INR
  "3173-2": range(25, 35), // aPTT, s

  // Arterial blood gas
  "2744-1": range(7.35, 7.45, 2), // pH
  "2019-8": range(35, 45), // pCO2, mm[Hg]
  "2703-7": range(75, 100), // pO2, mm[Hg]
  "1960-4": range(22, 26), // Bicarbonate, mmol/L

  // Heart
  "89579-7": range(null, 26, 2), // Troponin I, high sensitivity, pg/mL (= ng/L)
  "33762-6": range(null, 125, 0), // NT-proBNP, pg/mL

  // Iron studies
  "2276-4": range(15, 300), // Ferritin, ug/L
  "2498-4": range(60, 170), // Iron, ug/dL
  "2500-7": range(250, 450), // Iron binding capacity, ug/dL
  "2502-3": range(20, 50), // Iron saturation, %

  // Other
  "3016-3": range(0.4, 4.0, 2), // TSH, m[IU]/L
  "2857-1": range(null, 4.0, 2), // PSA, ng/mL
  "24467-3": range(500, 1500, 0), // CD4 T cells, /uL

  // Urine dipstick
  "5811-5": range(1.005, 1.03, 3), // Specific gravity
  "5803-2": range(4.5, 8.0, 2), // pH
  "5792-7": range(null, 15), // Glucose, mg/dL
  "5804-0": range(null, 15), // Protein, mg/dL
  "5797-6": range(null, 5), // Ketones, mg/dL
};

/** Decimals for codes with no entry in LAB_RANGES. */
export const DEFAULT_DECIMALS = 1;

/** The range for a lab code, or null when we don't hold one. */
export function labRange(code: string): LabRange | null {
  return LAB_RANGES[code] ?? null;
}

/** Rounds a value the way it is stored for this code. */
export function roundLabValue(code: string, value: number): number {
  const decimals = LAB_RANGES[code]?.decimals ?? DEFAULT_DECIMALS;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
