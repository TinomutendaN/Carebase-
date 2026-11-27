# Carebase — CLAUDE.md

**Always read `AGENTS.md` first, before doing anything else.** It holds the app's features on every screen and the build steps, in order, with the deliverables for each step.

Carebase is an AI operations platform for small clinics. It turns intake paperwork into patient records, tracks each patient's health data over time, and gives staff an assistant that answers with sources and knows its limits.

All data is synthetic (generated with Synthea). Every page shows a "synthetic data only" banner.

## Tech stack

Solo build, 48-hour target. Priorities: AI tooling support, documentation quality, time to first feature. Keep runtime dependencies at 9 or fewer.

One Next.js app with the backend as API routes inside it (the Quote Agent layout), so one push deploys everything.

### Runtime dependencies (9)

| # | Package | Why | Alternative considered |
|---|---|---|---|
| 1–3 | `next` (App Router, TypeScript), `react`, `react-dom` | One app for pages and API routes, so one deploy. Best-known framework for AI coding tools, with excellent docs. | Next.js plus FastAPI (Cite's layout): two deploys to keep in sync, slower to ship. |
| 4 | `ai` (Vercel AI SDK) | Covers every AI feature in one library: reading intake files into a fixed schema, the assistant's tools, streaming answers, and embeddings for the evidence library. | LangChain: more than needed, heavier to learn, more dependencies. |
| 5 | `@ai-sdk/openai` | Main model provider, using existing credits. The model is set in one file, `lib/ai/model.ts`, so it can be switched later. | Calling the provider's SDK directly: loses the shared tool and streaming layer. |
| 6 | `@ai-sdk/anthropic` | Keeps Claude one setting away, as in Quote Agent. Optional: drop it for 8 dependencies. | Supporting one provider only. |
| 7 | `@ai-sdk/react` | The `useChat` hook for the assistant panel: streaming, message state and tool results. | Hand-written fetch and streaming, which costs hours. |
| 8 | `zod` | One schema shape for intake fields, assistant tool inputs and API validation. The AI SDK uses it directly. | Valibot: smaller, but less support in AI tools and docs. |
| 9 | `@neondatabase/serverless` | Plain SQL to Neon Postgres. pgvector runs in the same database, so the evidence library needs no second service. Neon connects to Vercel in a few clicks. | Prisma or Drizzle: nicer types, but extra setup, migrations and dependencies that a demo of about 10 tables doesn't need. Supabase: its auth and storage would go unused. |

### Dev dependencies (not shipped)

- `typescript` and `tailwindcss`, the same as the portfolio and Quote Agent.
- `tsx`, to run the seed script and the test script from the terminal.

### Deliberately not dependencies

- **Charts:** hand-built SVG, matching the designs (lab trend chart with the shaded normal range, sparklines, the test results ring). No charting library.
- **Reading PDFs and photos:** the AI model reads them directly through the AI SDK. No OCR library.
- **Sign-in:** the role switcher stores the chosen role in a cookie. No auth library.
- **Icons and dates:** inline SVG icons and the browser's built-in date formatting.
- **Synthea:** a Java tool run once on the developer's machine to generate the patients. A small TypeScript script loads its FHIR files into Postgres, with no FHIR library. Java must be installed before day 1.

### Hosting

- Vercel for the app, with Neon Postgres from the Vercel Marketplace.

## Project structure

```
carebase/
├── app/
│   ├── page.tsx                  # Sign in (role switcher)
│   ├── tests/page.tsx            # Tests — public, outside the signed-in area
│   ├── (app)/                    # Everything behind sign-in
│   │   ├── layout.tsx            # Sidebar, top bar, synthetic-data banner
│   │   ├── dashboard/page.tsx
│   │   ├── patients/page.tsx     # Patient search and recently viewed
│   │   ├── patients/[id]/page.tsx
│   │   ├── intake/page.tsx
│   │   ├── tasks/page.tsx
│   │   └── admin/page.tsx
│   └── api/
│       ├── session/route.ts      # Set or clear the demo role
│       ├── search/route.ts       # Patient search, returns timing in ms
│       ├── intake/route.ts       # Upload and extract
│       ├── intake/[id]/route.ts  # Approve or reject
│       ├── patients/[id]/labs/route.ts  # One lab's results (refuses Front Desk)
│       ├── assistant/route.ts    # Streaming chat with tools
│       ├── tasks/route.ts
│       ├── export/route.ts       # De-identified export
│       └── tests/route.ts        # Latest test results
├── components/
│   ├── ui/                       # Card, Pill, Tag, Button, IconChip, Avatar
│   ├── charts/                   # LabTrendChart, Sparkline, ResultsRing (SVG)
│   └── screens/                  # Pieces used by one screen only
├── lib/
│   ├── ai/
│   │   ├── model.ts              # The one place the model is chosen
│   │   ├── intake-schema.ts      # zod schemas for forms and referral letters
│   │   ├── assistant-prompt.ts   # System prompt and refusal rules
│   │   ├── tools.ts              # getLabs, getWearables, getMedications
│   │   └── retrieval.ts          # Evidence library search (pgvector)
│   ├── db/
│   │   ├── client.ts             # Neon connection
│   │   └── queries/              # patients.ts, labs.ts, tasks.ts, audit.ts …
│   ├── access.ts                 # Who can see what, in one table
│   ├── session.ts                # Read the role cookie
│   ├── audit.ts                  # logView(), logChange(), logBlocked()
│   ├── follow-ups.ts             # Out-of-range lab → task
│   └── deidentify.ts             # Remove names, year-only births, date shift
├── db/
│   ├── schema.sql
│   └── seed.sql                  # Sample tasks (demo accounts are seeded by apply-schema)
├── scripts/
│   ├── import-synthea.ts         # FHIR files → Postgres (runs locally once)
│   ├── generate-wearables.ts
│   ├── build-evidence.ts         # Chunk and embed the public health pages
│   └── run-tests.ts              # Runs tests/cases.json, saves results
├── tests/
│   └── cases.json                # The 30–50 test questions and expected behaviour
├── data/
│   └── evidence/                 # Public health pages, as text
├── public/
│   └── samples/                  # The 8 intake forms and referral letters
├── designs/                      # Screenshots and HTML source of every screen
├── proxy.ts                      # Sends signed-out visitors to Sign in (Next 16 name for middleware)
└── CLAUDE.md
```

### Why it's laid out this way

- **`app/(app)/` for the signed-in screens.** The bracketed folder groups the six private screens under one shared layout (sidebar, top bar, banner) without adding "/app" to the URLs. Sign in and Tests sit outside it, so Tests is public with no extra code.
- **API routes next to the pages, in one app.** One repo, one deploy. Each route matches one action on the designs (search, approve intake, ask the assistant, export), so it's easy to find where a button's work happens.
- **Everything AI in `lib/ai/`.** The model choice, prompts, tools and retrieval live together. Switching models means changing `model.ts` only. Tuning the refusals means opening one prompt file.
- **`lib/access.ts` is the single source for role rules.** The "who sees what" table from the Admin screen lives here as one object. Pages, API routes, the assistant's tools and the tests all read from it, so a rule can never be enforced on one screen but missed in the API. Never hard-code a role check anywhere else.
- **`lib/audit.ts` with three small functions.** Every record view calls `logView()`, so logging is one line per page and can't be forgotten. Logging is on from day one.
- **`lib/follow-ups.ts` and `lib/deidentify.ts` as plain functions.** The two rules that matter most to healthcare clients (out-of-range lab → task, and the de-identification rules) are small, readable files that are easy to show a client and easy to test on their own.
- **`scripts/` for one-off jobs.** The Synthea import, wearables generator and evidence library build run locally with `tsx` and are never deployed, which keeps the live app small.
- **`tests/cases.json` kept separate from the code.** The test questions are data, so cases can be added without touching the runner. The Tests page reads the saved results, so it always shows the last real run.
- **`components/charts/` on their own.** The hand-built SVG charts live together, so the Dashboard spotlight and the Patient page share one lab chart instead of two copies.
- **`public/samples/` for the demo files.** The sample documents are reachable by both the app and visitors, so the Intake demo works on the live site.

## Design reference

The approved designs are in the `designs/` folder at the root of the repo. Build every screen to match them exactly. When this file and the designs disagree on a visual detail, the designs win.

```
designs/
├── 01-sign-in.png
├── 02-dashboard-clinician.png
├── 02-dashboard-front-desk.png
├── 02-dashboard-admin.png
├── 03-patient-clinician.png
├── 03-patient-assistant-open.png
├── 03-patient-front-desk.png
├── 04-intake.png
├── 05-tasks-clinician.png
├── 05-tasks-admin.png
├── 06-admin.png
├── 07-tests.png
└── source/
    ├── 01-sign-in.html
    ├── 02-dashboard.html
    ├── 03-patient.html
    ├── 04-intake.html
    ├── 05-tasks.html
    ├── 06-admin.html
    └── 07-tests.html
```

- **Screenshots (`.png`)** show how each screen looks, including each role's version.
- **Source files (`source/*.html`)** hold the exact values: colours, spacing, radii, shadows, glows, font sizes and copy. Read them for any detail a screenshot doesn't make clear. They are design references, not app code: don't copy their markup or scripts into the app. Rebuild each screen with the app's own components.
- One source file covers every role's version of a screen. The role differences are in the `role` logic at the bottom of each file (for example, Front Desk sees a locked box in place of lab charts).
- The sample names, numbers and dates in the designs are placeholders. In the app they come from the database.

Screens:

1. Sign in: role switcher (Front Desk, Clinician, Admin) and a link to Tests
2. Dashboard: Clinician, Front Desk and Admin versions, with the patient spotlight panel
3. Patient page: Clinician (assistant closed and open) and Front Desk versions
4. Intake: review of intake forms and referral letters
5. Tasks: Clinician and Admin versions, with the automatic follow-ups panel
6. Admin: audit log, de-identified export, roles
7. Tests: public page, no sign-in needed

## Design style

Clean, modern clinical SaaS with soft glassmorphism. A light lavender canvas with frosted-white surfaces, and deep indigo and dark-teal "feature" panels lit by soft inner glows. Calm, precise and trustworthy, never playful.

### Colour palette

| Use | Colour |
|---|---|
| Canvas | `#EDF0FA`, with a soft violet glow top-right (`#7C6CFF` at 22%) and a teal glow bottom-left (`#2DD4BF` at 14%) |
| Surfaces | White `#FFFFFF` to `#FBFCFF`; frosted glass at 70–78% white with 14px blur; hairline borders `#D6DCF0` |
| Primary blue | Gradient `#4C72F0` → `#2847C4` (buttons, logo, active states) |
| Dark teal panel | `#0F3142` → `#0A1C2B`; teal accent `#2DD4BF` / `#0E9F8E`; mint text `#5EEAD4`; muted text `#A7C4CF` |
| Indigo panel | `#25216A` → `#15163F`; violet glow `#7C5CFF`; lavender text `#C3C2E6` |
| AI accent | Violet gradient `#8B7BFF` → `#5B45E0` |
| Amber | `#FBBF24`: above range, due today, flagged |
| Red | `#E5484D`: overdue, failed, blocked |
| Green | `#22C55E`: passed, approved, in range |
| Text | Ink `#0F172A`, secondary `#5B6478`, labels `#6B7287` |
| Banner | Background `#FFF4D6`, text `#7A4B00` |

### Line weight

- Icons: outline style on a 24px grid, 1.8–2.2px strokes, rounded caps and joins, no fills.
- Borders: 1px hairlines. Dashed 1.5px for upload areas and normal-range bands.
- Charts: 3px amber trend lines, 2.2px sparklines, hollow round dots with 3px rings.

### Shapes and proportions

- Rounded everything: buttons 11–13px radius, cards 18–22px, feature panels 24–28px, pills fully round.
- Icon chips: rounded squares of about 40px, with the icon at 18px.
- People appear only as initials in gradient circles or rounded squares. No faces, no photos, no human figures.
- Generous spacing (20–28px inside cards) and strong hierarchy: big 800-weight numbers next to small labels.
- Layout: a 236px sidebar on the left, a frosted top bar, and content in a flexible area. On phones the sidebar stacks above the content.

### Lighting

- Soft ambient light from the top-right. No hard shadows.
- Light cards: long, faint blue-grey shadows (`0 14px 34px rgba(40,52,120,0.08)`).
- Dark panels: deep, soft shadows (`0 28px 70px rgba(8,30,45,0.4)`) plus inner radial glows in teal and violet.
- Key accents glow, such as teal icon chips, the active pill and the test results ring (`0 0 24px rgba(45,212,191,0.5)`), like light behind frosted glass.

### Typography

- Plus Jakarta Sans (weights 400–800) for everything.
- JetBrains Mono, uppercase and letter-spaced, for small technical labels such as "LAST 6 MONTHS" and "READ BY AI".

## Illustrations

Every illustration follows the design style above. Use the same palette, line weight, rounded shapes and soft glowing light, and no faces or human figures, so illustrations sit naturally next to the initials avatars.

| Screen | Illustration |
|---|---|
| Sign in | A paper intake form floating on glass, turning into a patient record card with a small trend chart and an assistant speech bubble, glowing on dark indigo |
| Dashboard | A stack of glass task cards with amber and red status dots, rising from a teal glow |
| Patient page | An abstract lab trend line passing through a shaded teal "normal range" band, with three small wearable cards (heart, moon, footsteps) |
| Intake | A scanned document under a teal scanning beam, with fields lifting off the page as highlighted boxes |
| Tasks | A lab result card linked by a glowing line to a task card, then to an initials avatar |
| Admin | A shield over a list of log entries, with a record turning into anonymous rows (a name crossed out and turning teal) |
| Tests | A glowing teal ring at 96% surrounded by small pass ticks and a single amber flag |
