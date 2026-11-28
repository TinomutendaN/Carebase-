/** Test run types and constants, shared by the Tests page, its API and scripts/run-tests.ts. */

/** The live site. Runs against it are the ones the Tests page shows by default. */
export const PRODUCTION_URL = "https://carebase-ashen.vercel.app";

export const TEST_CATEGORIES = ["numbers", "sources", "refusals", "data_leaks", "role_rules"] as const;
export type TestCategory = (typeof TEST_CATEGORIES)[number];

export type TestResult = {
  caseId: string;
  category: TestCategory;
  question: string;
  expected: string;
  passed: boolean;
  /** What the assistant (or the API) actually did. */
  actual: string | null;
  /** Which check failed, in plain words. */
  reason: string | null;
  patient: string | null;
};

export type TestRun = {
  id: number;
  ranAt: string;
  model: string | null;
  total: number;
  passed: number;
  baseUrl: string | null;
  live: boolean;
  durationMs: number | null;
  results: TestResult[];
};
