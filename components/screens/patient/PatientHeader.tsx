import type { PatientSummary } from "@/lib/db/queries/patients";
import { formatDate } from "@/lib/format";

/** Initials, name, MRN / age / sex chips and last visit (designs/source/03-patient.html). */
export function PatientHeader({ patient }: { patient: PatientSummary }) {
  return (
    <section
      aria-label="Patient"
      className="flex flex-wrap items-center justify-between gap-[18px] rounded-[22px] border border-hairline/90 bg-linear-to-b from-surface to-surface-soft px-[22px] py-5 shadow-[0_1px_2px_rgba(40,52,120,0.05),0_14px_34px_rgba(40,52,120,0.09)]"
    >
      <div className="flex items-center gap-[18px]">
        <span
          aria-hidden="true"
          className="flex size-[72px] flex-none items-center justify-center rounded-[22px] bg-linear-145 from-[#7C6CFF] to-[#3F51D8] text-2xl font-extrabold text-white shadow-[0_10px_24px_rgba(76,90,230,0.35)]"
        >
          {patient.initials}
        </span>
        <div className="flex flex-col gap-2.5">
          <h2 className="m-0 text-2xl font-extrabold tracking-[-0.01em]">{patient.name}</h2>
          <div className="flex flex-wrap gap-2">
            <Chip label="MRN" value={patient.mrn} />
            <Chip label="AGE" value={String(patient.age)} />
            {patient.sex && <Chip label="SEX" value={patient.sex} />}
          </div>
        </div>
      </div>
      <span className="text-xs text-secondary">
        {patient.lastVisit ? `Last visit ${formatDate(patient.lastVisit)}` : "No visits recorded"}
      </span>
    </section>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-[9px] border border-[#E3E7F2] bg-[#F4F6FB] px-2.5 py-1.5 text-[13px] font-bold">
      <span className="text-[11px] font-semibold text-label">{label} </span>
      {value}
    </span>
  );
}
