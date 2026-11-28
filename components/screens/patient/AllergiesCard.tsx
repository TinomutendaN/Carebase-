import { cx } from "@/lib/cx";
import type { Allergy } from "@/lib/db/queries/patients";

const CARD =
  "flex flex-col gap-3.5 rounded-[22px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft p-5 shadow-card";

/** Allergy pills: severe in red, others in amber. */
export function AllergiesCard({ allergies }: { allergies: Allergy[] }) {
  return (
    <section id="allergies" aria-labelledby="allergy-title" className={cx(CARD, "flex-[1_1_260px]")}>
      <h2 id="allergy-title" className="m-0 text-xs font-bold tracking-[0.12em] text-label">
        ALLERGIES
      </h2>
      {allergies.length === 0 ? (
        <p className="m-0 text-sm text-secondary">No known allergies</p>
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {allergies.map((a) => (
            <li
              key={a.id}
              title={a.severity ? `${a.severity} reaction` : undefined}
              className={cx(
                "rounded-full px-3.5 py-2 text-[13px] font-bold",
                a.severity === "severe" ? "bg-[#FDECEC] text-[#B42318]" : "bg-[#FFF1D6] text-[#8A4B00]",
              )}
            >
              {a.substance}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
