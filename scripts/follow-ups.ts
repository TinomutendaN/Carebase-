/**
 * Turn recent out-of-range lab results into follow-up tasks (lib/follow-ups.ts).
 * Run after importing. Safe to run more than once. Run with: npm run db:follow-ups
 */
import { clinicTimeZone, clinicToday } from "../lib/clinic-date";
import { createFollowUps, FOLLOW_UP_WINDOW_DAYS } from "../lib/follow-ups";

async function main() {
  console.log(`Clinic today: ${clinicToday()} (${clinicTimeZone()}), looking back ${FOLLOW_UP_WINDOW_DAYS} days.`);
  const { created, updated, reopened } = await createFollowUps();
  for (const t of created) console.log(`  + #${t.taskId} ${t.patientName} (${t.labDay}): ${t.title}, due ${t.dueOn}`);
  for (const t of updated) console.log(`  ~ #${t.taskId} ${t.patientName} (${t.labDay}): ${t.title}, due ${t.dueOn}`);
  for (const t of reopened) console.log(`  ↺ #${t.taskId} ${t.patientName} (${t.labDay}): ${t.title}, due ${t.dueOn}`);
  if (created.length + updated.length + reopened.length === 0) console.log("0 new (already up to date).");
  else console.log(`${created.length} created, ${updated.length} updated, ${reopened.length} reopened.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
