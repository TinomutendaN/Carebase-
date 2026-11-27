import type { Condition } from "@/lib/db/queries/patients";
import { formatMonthYear } from "@/lib/format";

/** Active conditions with their onset month. */
export function ConditionsCard({ conditions }: { conditions: Condition[] }) {
  return (
    <section
      aria-labelledby="cond-title"
      className="flex flex-[2_1_380px] flex-col gap-1.5 rounded-[22px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft p-5 shadow-card"
    >
      <h2 id="cond-title" className="m-0 mb-1.5 text-xs font-bold tracking-[0.12em] text-label">
        ACTIVE CONDITIONS
      </h2>
      {conditions.length === 0 ? (
        <p className="m-0 border-t border-divider pt-2.5 text-sm text-secondary">No active conditions</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {conditions.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-t border-divider py-2.5">
              <span aria-hidden="true" className="size-[9px] flex-none rounded-full bg-[#F59E0B]" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold">{c.name}</span>
                {c.onsetOn && <span className="text-xs text-secondary">Since {formatMonthYear(c.onsetOn)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
