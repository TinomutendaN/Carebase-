import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LabLegend, LabTrendChart, type LabPoint } from "@/components/charts/LabTrendChart";
import { ResultsRing } from "@/components/charts/ResultsRing";
import { Sparkline } from "@/components/charts/Sparkline";
import { Sidebar } from "@/components/shell/Sidebar";
import { SearchField, TaskBell, TopBar, TopBarAccount } from "@/components/shell/TopBar";
import { ACCOUNT_GRADIENT, AVATAR_GRADIENTS, Avatar } from "@/components/ui/Avatar";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconChip, type ChipColor } from "@/components/ui/IconChip";
import * as Icons from "@/components/ui/icons";
import { Panel } from "@/components/ui/Panel";
import { Pill, PillGroup } from "@/components/ui/Pill";
import { SourceTag, STATUS_KEYS, StatusTag } from "@/components/ui/StatusTag";
import { LabSwitcherDemo, type DemoLab } from "./LabSwitcherDemo";

/**
 * Dev-only preview of every shared component and chart with sample data, for
 * comparing against designs/. Returns 404 in production. Sample data lives here only.
 */

export const metadata: Metadata = { title: "Components · Carebase dev", robots: { index: false, follow: false } };

// ---------- Sample data (fixed dates, so the page renders the same every time) ----------

function iso(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

/** Deterministic wobble in [-1, 1]. */
const wobble = (i: number) => Math.sin(i * 12.9898) * 0.5 + Math.sin(i * 4.1414) * 0.5;

// The design's six monthly HbA1c results.
const designHba1c: LabPoint[] = [6.9, 7.1, 7.2, 7.4, 7.6, 7.9].map((value, i) => ({
  date: iso(2026, 6 + i, [10, 9, 14, 11, 13, 12][i]),
  value,
}));

// Five years of HbA1c, about every 3 months, rising from in range to above range.
const fiveYearHba1c: LabPoint[] = Array.from({ length: 20 }, (_, i) => ({
  id: `hba1c-${i}`,
  date: iso(2021, 12 + i * 3, 8 + (i % 4) * 5),
  value: Number((5.2 + i * 0.14 + wobble(i) * 0.15).toFixed(1)),
}));

// 60 glucose results in mg/dL over five years, mixing below, in and above range.
const glucose: LabPoint[] = Array.from({ length: 60 }, (_, i) => ({
  id: `glu-${i}`,
  date: iso(2021, 12 + i, 3 + (i * 7) % 24),
  value: Math.round(88 + wobble(i) * 40 + i * 0.4),
}));

// LDL in mg/dL with only an upper target.
const ldl: LabPoint[] = Array.from({ length: 10 }, (_, i) => ({
  date: iso(2022, 1 + i * 6, 15),
  value: Math.round(96 + i * 5 + wobble(i) * 10),
}));

const switcherLabs: DemoLab[] = [
  { key: "hba1c", short: "HbA1c", name: "HbA1c", unit: "%", low: 4.0, high: 5.6, rangeLabel: "Normal range 4.0–5.6%", points: fiveYearHba1c },
  { key: "glucose", short: "Glucose", name: "Glucose", unit: "mg/dL", low: 70, high: 99, rangeLabel: "Normal range 70–99 mg/dL", points: glucose },
  { key: "ldl", short: "LDL", name: "LDL cholesterol", unit: "mg/dL", low: null, high: 100, rangeLabel: "Target under 100 mg/dL", points: ldl },
];

// Wearable sparklines from the design (14 days).
const heart = [78, 82, 76, 80, 74, 79, 83, 77, 81, 75, 80, 84, 78, 82];
const sleep = [6.3, 6.0, 6.5, 5.9, 6.2, 5.7, 6.0, 6.3, 5.9, 6.2, 5.5, 6.0, 6.2, 5.9];
const steps = [3900, 4300, 4100, 4700, 4500, 5100, 4700, 4900, 5300, 5100, 5500, 5100, 5700, 5500];

const ACCOUNTS = {
  front_desk: { name: "Demo Front Desk", initials: "FD" },
  clinician: { name: "Demo Clinician", initials: "CL" },
  admin: { name: "Demo Admin", initials: "AD" },
} as const;

const TOKENS: [string, string][] = [
  ["canvas", "#EDF0FA"], ["hairline", "#D6DCF0"], ["ink", "#0F172A"], ["secondary", "#5B6478"], ["label", "#6B7287"],
  ["primary", "#4C72F0"], ["primary-deep", "#2847C4"], ["primary-ink", "#2442A8"], ["teal", "#2DD4BF"], ["teal-deep", "#0E9F8E"],
  ["mint", "#5EEAD4"], ["teal-panel", "#0F3142"], ["indigo-panel", "#25216A"], ["ai", "#8B7BFF"], ["amber", "#FBBF24"],
  ["red", "#E5484D"], ["green", "#22C55E"], ["banner", "#FFF4D6"],
];

// ---------- Page ----------

export default function ComponentsPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const icons = Object.entries(Icons).filter(([name]) => name !== "Icon" && name.endsWith("Icon")) as [string, (p: Icons.IconProps) => ReactNode][];

  return (
    <>
      <Banner />
      <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-8 px-8 pt-7 pb-16">
        <header className="flex flex-col gap-1">
          <span className="font-mono text-[11px] tracking-[0.14em] text-label uppercase">Dev only · 404 in production</span>
          <h1 className="text-[28px] font-extrabold tracking-tight">Components and charts</h1>
          <p className="text-sm text-secondary">Sample data only. Compare against designs/*.png.</p>
        </header>

        <Section title="Colours">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
            {TOKENS.map(([name, hex]) => (
              <div key={name} className="flex items-center gap-2.5 text-xs">
                <span className="size-8 rounded-lg border border-hairline" style={{ background: hex }} />
                <span className="flex flex-col">
                  <span className="font-semibold">{name}</span>
                  <span className="font-mono text-label">{hex}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-6 pt-2">
            <span className="text-[32px] leading-tight font-extrabold tracking-[-0.02em]">Plus Jakarta 800</span>
            <span className="self-center font-mono text-[11px] tracking-[0.14em] text-label">JETBRAINS MONO · LAST 5 YEARS</span>
          </div>
        </Section>

        <Section title="Icons">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
            {icons.map(([name, IconComponent]) => (
              <div key={name} className="flex items-center gap-2.5 text-xs text-nav-text">
                <IconComponent />
                <span>{name.replace("Icon", "")}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Sidebar, one per role (sample badge counts)">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(236px,1fr))] gap-6">
            {(["front_desk", "clinician", "admin"] as const).map((role) => (
              <div key={role} className="flex min-h-[560px] overflow-hidden rounded-[18px] border border-hairline">
                <Sidebar role={role} account={ACCOUNTS[role]} counts={{ intake: 3, tasks: role === "admin" ? 12 : role === "clinician" ? 7 : 5 }} activeHref="/dashboard" />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Top bar">
          <div className="overflow-hidden rounded-[18px] border border-hairline">
            <TopBar section="OVERVIEW" title="Dashboard">
              <SearchField />
              <TaskBell count={3} />
              <TopBarAccount initials="CL" />
            </TopBar>
          </div>
        </Section>

        <Section title="Cards and panels">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-[18px]">
            {(
              [
                ["purple", <Icons.TasksIcon key="i" strokeWidth={2} />, "7", "Your open tasks", "1 overdue"],
                ["amber", <Icons.ClockIcon key="i" />, "3", "Tasks due today", "Next by 11:00"],
                ["blue", <Icons.PulseIcon key="i" />, "9", "Out-of-range lab results this week", "4 high, 5 low"],
                ["green", <Icons.PeopleIcon key="i" />, "200", "Patients", "+4 this week"],
              ] as [ChipColor, ReactNode, string, string, string][]
            ).map(([color, icon, value, label, meta]) => (
              <Card key={label} className="flex flex-col gap-3.5">
                <div className="flex items-start justify-between">
                  <IconChip color={color}>{icon}</IconChip>
                  <Icons.MoreIcon className="text-[#8A91A6]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em]">{value}</span>
                  <span className="text-sm text-secondary">{label}</span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-divider pt-3 text-xs">
                  <span className="text-secondary">{meta}</span>
                  <span className="font-semibold text-primary-ink">Open Tasks →</span>
                </div>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-[18px]">
            <Panel tone="teal" className="flex flex-col gap-3">
              <div className="flex items-center gap-3.5">
                <IconChip color="teal" size={44}>
                  <Icons.PulseIcon size={20} />
                </IconChip>
                <div className="flex flex-col gap-[3px]">
                  <h3 className="text-lg font-bold">Teal panel</h3>
                  <span className="font-mono text-xs text-teal-muted">PATIENT SPOTLIGHT · LAB CARD</span>
                </div>
              </div>
            </Panel>
            <Panel tone="indigo" className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <IconChip color="teal" size={40}>
                  <Icons.TasksIcon strokeWidth={2} />
                </IconChip>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-base font-bold">Indigo panel</h3>
                  <span className="text-xs text-lavender">Most urgent tasks · Tests summary</span>
                </div>
              </div>
            </Panel>
          </div>
        </Section>

        <Section title="Pills (filter tabs and lab switcher)">
          <div className="flex flex-wrap items-center gap-6">
            <PillGroup label="Filter tasks">
              <Pill pressed count={12}>All</Pill>
              <Pill pressed={false} count={2}>Overdue</Pill>
              <Pill pressed={false} count={5}>Due today</Pill>
              <Pill pressed={false} count={5}>Upcoming</Pill>
            </PillGroup>
            <div className="on-dark rounded-2xl bg-teal-panel-deep p-4">
              <PillGroup label="Lab test" tone="dark">
                <Pill tone="dark" pressed>HbA1c</Pill>
                <Pill tone="dark" pressed={false}>Glucose</Pill>
                <Pill tone="dark" pressed={false}>LDL</Pill>
              </PillGroup>
            </div>
          </div>
        </Section>

        <Section title="Status and source tags">
          <div className="flex flex-wrap items-center gap-2.5">
            {STATUS_KEYS.map((s) => <StatusTag key={s} status={s} />)}
            <SourceTag source="lab" />
            <SourceTag source="staff" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-indigo-panel-deep p-4">
            {STATUS_KEYS.map((s) => <StatusTag key={s} status={s} tone="dark" />)}
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" className="min-w-40">Approve and create</Button>
            <Button size="lg" variant="secondary">Reject</Button>
            <Button size="lg" disabled className="min-w-40">Fill 2 fields to approve</Button>
            <Button size="lg" variant="teal">Export de-identified data</Button>
            <Button href="/tests" size="bar">Sign in to the demo</Button>
            <Button href="/tasks" round className="min-h-[38px]">View all</Button>
          </div>
          <div className="on-dark flex flex-wrap items-center gap-3 rounded-2xl bg-teal-panel-deep p-4">
            <Button href="/patients" variant="ghost-dark" icon={<Icons.ArrowRightIcon />}>Open Record</Button>
          </div>
        </Section>

        <Section title="Keyboard focus ring (Tab through the page to see it live)">
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" data-focus-preview className="min-h-[42px] cursor-pointer rounded-xl bg-linear-145 from-primary to-[#2F55E0] px-4 text-[13px] font-bold text-white">Button</button>
            <span data-focus-preview className="rounded-[13px] border border-[#E3E7F2] bg-tab-track p-1">
              <span className="inline-flex min-h-[34px] items-center rounded-[9px] bg-surface px-3 text-[13px] font-semibold text-primary-ink shadow-tab">Pill</span>
            </span>
            <a data-focus-preview href="#" className="rounded-md text-sm font-semibold text-primary-ink">Open Record link</a>
            <span data-focus-preview className="box-border flex h-11 w-64 items-center gap-2.5 rounded-xl border border-field-border bg-surface px-3.5 text-sm text-label shadow-field">
              <Icons.SearchIcon /> Input
            </span>
            <span className="on-dark rounded-2xl bg-teal-panel-deep p-4">
              <span data-focus-preview className="inline-flex min-h-[42px] items-center rounded-xl border border-white/14 bg-white/6 px-4 text-[13px] font-semibold text-white">On a dark panel</span>
            </span>
          </div>
        </Section>

        <Section title="Icon chips and avatars">
          <div className="flex flex-wrap items-center gap-3">
            {(["blue", "green", "amber", "purple", "teal", "primary", "ai"] as ChipColor[]).map((c) => (
              <IconChip key={c} color={c}>
                <Icons.PulseIcon />
              </IconChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Avatar initials="CL" gradient={ACCOUNT_GRADIENT} online />
            <Avatar initials="AD" gradient={ACCOUNT_GRADIENT} shape="square" size={40} />
            {["MH", "SR", "DC", "GM", "OF", "AR", "DO", "JM"].map((i, n) => (
              <Avatar key={i} initials={i} gradient={AVATAR_GRADIENTS[n]} size={30} />
            ))}
            <Avatar initials="BH" size={56} shape="square" />
          </div>
        </Section>

        <Section title="Lab trend chart">
          <Panel tone="teal" className="flex flex-col gap-5">
            <h3 className="text-base font-bold">Design match: 6 monthly HbA1c results</h3>
            <ChartBox>
              <LabTrendChart points={designHba1c} low={4.0} high={5.6} unit="%" name="HbA1c" label="HBA1C · LAST 6 MONTHS" rangeLabel="Normal range 4.0–5.6%" />
            </ChartBox>
            <LabLegend note="Synthetic patient · values for demo only" />
          </Panel>
          <Panel tone="teal" className="flex flex-col gap-5">
            <h3 className="text-base font-bold">Switcher with 5 years of data (20 HbA1c, 60 glucose, 10 LDL with an upper target only)</h3>
            <LabSwitcherDemo labs={switcherLabs} period="LAST 5 YEARS" />
          </Panel>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-[18px]">
            <Panel tone="teal">
              <ChartBox>
                <LabTrendChart points={[{ date: "2026-11-12", value: 5.1 }]} low={4.0} high={5.6} unit="%" name="HbA1c" label="ONE RESULT · IN RANGE" rangeLabel="Normal range 4.0–5.6%" />
              </ChartBox>
            </Panel>
            <Panel tone="teal">
              <ChartBox>
                <LabTrendChart points={[]} low={4.0} high={5.6} unit="%" name="HbA1c" label="NO RESULTS" />
              </ChartBox>
            </Panel>
          </div>
        </Section>

        <Section title="Sparklines and results ring">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-[18px]">
            <Panel tone="teal" className="flex flex-col gap-3">
              <span className="font-mono text-[11px] tracking-[0.14em] text-mint-label">WEARABLES · LAST 14 DAYS</span>
              <Wearable label="HEART RATE" value="78" unit="bpm" values={heart} color="#F87171" />
              <Wearable label="SLEEP" value="6h 10m" unit="per night" values={sleep} color="#A78BFA" />
              <Wearable label="STEPS" value="4,820" unit="per day" values={steps} color="#2DD4BF" />
              <Wearable label="ONE READING" value="72" unit="bpm" values={[72]} color="#F87171" />
              <Wearable label="FLAT" value="8,000" unit="per day" values={[8000, 8000, 8000]} color="#2DD4BF" />
            </Panel>
            <Panel tone="indigo" className="flex flex-wrap items-center gap-8">
              <ResultsRing passed={46} total={48} />
              <ResultsRing passed={30} total={48} size={120} />
              <ResultsRing passed={0} total={0} size={96} />
            </Panel>
          </div>
        </Section>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" size="lg" className="flex flex-col gap-4">
      <h2 className="text-[17px] font-bold">{title}</h2>
      {children}
    </Card>
  );
}

function ChartBox({ children }: { children: ReactNode }) {
  return <div className="rounded-[20px] border border-white/8 bg-[rgba(3,16,26,0.45)] px-5 py-[18px]">{children}</div>;
}

function Wearable({ label, value, unit, values, color }: { label: string; value: string; unit: string; values: number[]; color: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-linear-to-b from-white/7 to-white/2 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold tracking-[0.1em] text-teal-muted">{label}</span>
        <span className="text-[11px] text-chart-text">avg</span>
      </div>
      <span className="text-[22px] font-extrabold">
        {value} <span className="text-xs font-medium text-teal-muted">{unit}</span>
      </span>
      <Sparkline values={values} color={color} />
    </div>
  );
}
