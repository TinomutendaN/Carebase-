import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AllergiesCard } from "@/components/screens/patient/AllergiesCard";
import { ConditionsCard } from "@/components/screens/patient/ConditionsCard";
import { LabTrendsPanel } from "@/components/screens/patient/LabTrendsPanel";
import { PatientHeader } from "@/components/screens/patient/PatientHeader";
import { Timeline } from "@/components/screens/patient/Timeline";
import { WearableCards } from "@/components/screens/patient/WearableCards";
import { PatientsTopBar, PatientsTopBarFallback } from "@/components/screens/search/PatientsTopBar";
import { can } from "@/lib/access";
import { logView } from "@/lib/audit";
import { getLabSeries, getMainLabCodes } from "@/lib/db/queries/labs";
import {
  getActiveConditions,
  getAllergies,
  getPatient,
  getTimeline,
  getWearables,
} from "@/lib/db/queries/patients";
import { getSession } from "@/lib/session";

/** The Patient page (designs/03-patient-*.png). Lab results only for roles with lab access. */
export default function PatientPage({ params }: PageProps<"/patients/[id]">) {
  return (
    <>
      <Suspense fallback={<PatientsTopBarFallback />}>
        <PatientsTopBar />
      </Suspense>
      <div className="box-border flex flex-col gap-[22px] px-8 pt-[26px] pb-9 max-sm:px-4">
        <Suspense fallback={<PatientSkeleton />}>
          <PatientRecord params={params} />
        </Suspense>
      </div>
    </>
  );
}

async function PatientRecord({ params }: { params: PageProps<"/patients/[id]">["params"] }) {
  const session = await getSession();
  if (!session) redirect("/");
  if (!can(session.role, "patient_records")) redirect("/dashboard");

  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();

  const showLabs = can(session.role, "lab_results");
  const record = { type: "patient", id: patient.id, label: patient.name };

  const [labs, allergies, conditions, wearables] = await Promise.all([
    showLabs ? getMainLabCodes(patient.id) : null,
    getAllergies(patient.id),
    getActiveConditions(patient.id),
    getWearables(patient.id),
    logView(session, "Viewed record", record),
  ]);
  const labCodes = labs?.map((l) => l.code) ?? [];

  const [initial, timeline] = await Promise.all([
    labs?.length ? getLabSeries(patient.id, labs[0].code) : null,
    getTimeline(patient.id, { includeLabs: showLabs, labCodes }),
    showLabs && labCodes.length ? logView(session, "Viewed lab results", record, { via: "page", codes: labCodes }) : null,
  ]);

  return (
    <>
      <PatientHeader patient={patient} />
      <LabTrendsPanel patientId={patient.id} labs={labs} initial={initial}>
        <WearableCards wearables={wearables} />
      </LabTrendsPanel>
      <div className="flex flex-wrap gap-[22px]">
        <AllergiesCard allergies={allergies} />
        <ConditionsCard conditions={conditions} />
      </div>
      <Timeline entries={timeline} labsHidden={!showLabs} canViewDocuments={can(session.role, "intake")} />
    </>
  );
}

function PatientSkeleton() {
  const block = "rounded-[22px] border border-hairline/90 bg-surface/70";
  return (
    <div aria-busy="true" aria-label="Loading patient record" className="flex flex-col gap-[22px]">
      <div className={`${block} h-[112px]`} />
      <div className="h-[420px] rounded-[26px] bg-linear-165 from-teal-panel to-teal-panel-deep opacity-90" />
      <div className="flex flex-wrap gap-[22px]">
        <div className={`${block} h-[200px] flex-[1_1_260px]`} />
        <div className={`${block} h-[200px] flex-[2_1_380px]`} />
      </div>
    </div>
  );
}
