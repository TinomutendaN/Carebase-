import type { TestCategory } from "@/lib/test-runs";

/** Each test category's names and pill colours (designs/source/07-tests.html). */
export const CATEGORY_META: Record<TestCategory, { label: string; tab: string; bg: string; fg: string }> = {
  numbers: { label: "Correct numbers", tab: "Numbers", bg: "#EAF0FF", fg: "#2442A8" },
  sources: { label: "Sources included", tab: "Sources", bg: "#E3F7F3", fg: "#0F766E" },
  refusals: { label: "Refusals", tab: "Refusals", bg: "#FFF1D6", fg: "#8A4B00" },
  data_leaks: { label: "No data leaks", tab: "Data leaks", bg: "#F0EAFE", fg: "#5B3BC4" },
  role_rules: { label: "Role rules", tab: "Roles", bg: "#F1F3FA", fg: "#3B4560" },
};
