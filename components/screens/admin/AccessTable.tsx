import { ACCESS, AREA_LABELS, AREAS, ROLE_LABELS, ROLES } from "@/lib/access";

/**
 * Who can see what, built from ACCESS in lib/access.ts (the rules every page, API
 * and test reads), so this table can never disagree with what's enforced.
 */
export function AccessTable() {
  const grid = "grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] items-center";
  return (
    <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-[14px] border border-[#E8EBF3] text-[13px]">
      <caption className="sr-only">Who can see what, by role</caption>
      <thead>
        <tr className={`${grid} bg-[#F4F6FB] px-3 py-2.5 text-[11px] font-bold tracking-[0.06em] text-secondary`}>
          <th scope="col" className="text-left font-bold">ACCESS</th>
          {ROLES.map((r) => (
            <th key={r} scope="col" className="text-center font-bold">{ROLE_LABELS[r].toUpperCase()}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {AREAS.map((area) => (
          <tr key={area} className={`${grid} border-t border-divider px-3 py-[9px]`}>
            <th scope="row" className="text-left font-semibold">{AREA_LABELS[area]}</th>
            {ROLES.map((r) => (
              <td key={r} className="flex justify-center">
                {ACCESS[area][r] ? (
                  <span role="img" aria-label="Yes" className="flex size-6 items-center justify-center rounded-lg bg-[#E3F6EC] text-[13px] font-extrabold text-[#15803D]">✓</span>
                ) : (
                  <span role="img" aria-label="No" className="flex size-6 items-center justify-center rounded-lg bg-tab-track text-[13px] font-extrabold text-[#8A91A6]">–</span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
