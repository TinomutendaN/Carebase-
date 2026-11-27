# AGENTS.md

**App name:** Carebase

**Description:** Carebase is an AI operations platform for small clinics that turns intake paperwork into patient records, tracks each patient's health data over time, and gives staff an assistant that answers with sources and knows its limits.

## Feature Implementation

When building a feature:

1. Read this file first.
2. Identify the files to change.
3. Keep changes focused.
4. Do not rewrite unrelated code.
5. Follow existing patterns.
6. Make sure the feature works end to end.
7. Fix lint and type errors before finishing.

- Build clean, simple code.
- Replicate UI exactly when designs are provided.

## Features by screen

### 1. Sign in (everyone)

- A role switcher: Front Desk, Clinician, or Admin
- A demo account for each role, with a line on what that role can see
- A "Continue as [role]" button that updates with your pick
- A "View test results" link that opens Tests without signing in
- The Carebase pitch and three feature highlights

### 2. Dashboard (all roles, the first screen after sign in)

- Four number cards, different for each role, each linking to the screen it comes from:
  - **Front Desk:** intake forms waiting for review, their open tasks, tasks due today, patients added this week
  - **Clinician:** their open tasks, tasks due today, out-of-range lab results this week, patients
  - **Admin:** patients, all open tasks, intake forms waiting for review, tests passing
- **Patient spotlight:** the most urgent patient, with a lab trend chart (normal range shaded), a switcher for HbA1c, Glucose and LDL, wearable trend cards, and an "Open Record" button
  - Front Desk sees a locked box in place of the lab chart
- **Most urgent tasks:** cards with a status tag, the patient, a due date, and an "Open Record" link
  - Admins also see who each task is assigned to
- A patient search bar and a task-due bell in the top bar

### 3. Patient page (all roles)

- A search bar showing how fast it found the patient (for example "1 match · 84 ms"), with recently viewed patients before typing and a dropdown when several patients match
- A header with the initials avatar, name, MRN, age, sex, and last visit
- Lab trends with the normal range shaded and a switcher for HbA1c, Glucose and LDL (hidden for Front Desk)
- Wearable data: heart rate, sleep and steps
- Allergies and Active Conditions
- A timeline of visits, labs and medications, newest first (lab entries hidden for Front Desk)
- **Assistant** (Clinicians and Admins only):
  - Opened with an "Ask assistant" button
  - A floating window you can drag, or move with the arrow keys
  - Answers about the current patient only, with source links that jump to the exact lab results
  - Declines diagnosis or treatment requests and says they're clinical decisions
- Every view recorded in the audit log

### 4. Intake (Front Desk and Admins)

- Upload intake forms or referral letters, as PDF or photo
- A queue of documents waiting for review, marked Flagged or Ready, plus a list of those approved today
- A preview of the scanned page, with the fields the AI read outlined (problem fields in amber)
- **Extracted details:**
  - Intake forms: name, date of birth, insurance, medications, reason for visit
  - Referral letters: patient name and date of birth, referring doctor and practice, reason for referral, urgency, letter date
- Flags for missing or expired details, such as an expired insurance card or a referral with no date of birth
- Staff check and fix every field, and nothing is saved until they approve
- **On approval:**
  - An intake form creates the patient
  - A referral letter attaches to an existing patient if the name and date of birth match, or creates a new one if not
- Approval is blocked until missing fields are filled in

### 5. Tasks (all roles)

- Summary cards: open, overdue, due today, done this week
- Filter tabs: All, Overdue, Due today, Upcoming
- Each task has a checkbox, a status tag, the patient, a due date, and an "Open Record" link
- A source label on each task: "AUTO · LAB" for tasks created from lab results, "STAFF" for tasks added by people
- Out-of-range lab results create follow-up tasks automatically, with an assignee and a due date (2 days after the result)
- An "Automatic follow-ups" panel showing how the latest task was created: lab result, then task, then assigned
- **By role:**
  - Front Desk and Clinicians see their own tasks
  - Admins see all tasks, with who each is assigned to

### 6. Admin (Admins only)

- **Audit log:**
  - Who viewed or changed which record, and when
  - Filters for views, changes and blocked attempts
  - Refused access, such as Front Desk trying to open labs, is logged and highlighted
- **De-identified export:**
  - Names and identifiers removed, birth dates reduced to the year, all dates shifted
  - A before-and-after preview row
- **Roles:**
  - The demo accounts, with a role dropdown for each
  - A table of who can see what

### 7. Tests (anyone, no sign-in needed)

- A results ring (46 of 48 passing) and the last run time
- A pass rate for each category: correct numbers, sources included, refusals, no data leaks, role rules
- Filter tabs: All, Failing, and one per category
- Each test has its question or action, the expected behaviour, and a pass or fail result
- Failed tests show what the assistant actually did
- Includes the role rules: Front Desk can't see labs or open the assistant, Clinicians can't open intake, and only Admins see the audit log
- Results come from the test script

### On every screen

- A "synthetic data only" banner
- A sidebar showing only the screens your role can open, except on Tests and Sign in
- The signed-in account at the bottom of the sidebar, with a "Switch role" link

## Build steps

Build in this order. Each step lists what to build and the deliverables that show it's done. Do not start a step until the previous step's deliverables are met. Total is about 59 hours, so follow the cut order at the end if time runs short.

### Step 0: Accounts and keys (30 min)

**Build:** Check Java is installed (for Synthea), get the OpenAI key, and set a spending limit on it.

**Deliverables:**
- Java, Node, GitHub, Vercel and the OpenAI key all ready
- A spending limit in place, so the public demo can't run up a bill

### Step 1: Project setup and first deploy (1.5h)

**Build:** Create the Next.js app, install the 9 dependencies, set up the folder structure from CLAUDE.md, connect Neon (with pgvector turned on) through Vercel, and deploy straight away.

**Deliverables:**
- The repo on GitHub with the agreed structure
- An empty page loading on the Vercel URL
- `DATABASE_URL` and the model key working both locally and on Vercel

### Step 2: Database, roles and audit log (2h)

**Build:**
- `db/schema.sql` with the tables: patients, visits, lab results, medications, allergies, conditions, wearable readings, tasks, intake documents, audit log, evidence chunks and test results
- `lib/access.ts` (who sees what)
- `lib/session.ts` (the role cookie)
- `lib/audit.ts`

**Deliverables:**
- All tables created in Neon
- The access table matching the Admin screen's roles table
- A role cookie that can be set and read
- An audit row written by a test call

### Step 3: Synthetic data (7h)

**Build:**
- Generate about 200 patients with Synthea
- `scripts/import-synthea.ts` to load patients, visits, labs (with lab codes, units and normal ranges), medications, allergies and conditions
- `scripts/generate-wearables.ts`
- Search indexes
- `db/seed.sql` with the three demo accounts

**Deliverables:**
- About 200 patients in the database, each with labs, medications, allergies, conditions and 14+ days of wearable data
- Fast name search confirmed (well under 100 ms)

### Step 4: App shell and shared components (3h)

**Build:**
- The signed-in layout (sidebar filtered by role, frosted top bar, synthetic-data banner)
- The UI pieces (card, pill, tag, button, icon chip, initials avatar)
- The SVG charts (lab trend with shaded range, sparkline, results ring)
- Fonts and colours from CLAUDE.md

**Deliverables:**
- An empty page for each of the 7 screens, reachable from a sidebar that matches each role
- The charts rendering with sample data, matching the canvas

### Step 5: Sign in and Patient page (6h)

**Build:**
- Sign in with the role switcher
- `middleware.ts` (signed-out visitors go to Sign in)
- The search API with timing, the recently viewed list and the results dropdown
- The Patient page: header, lab trends, wearables, allergies, conditions and timeline
- Labs hidden for Front Desk
- Every view logged

**Deliverables:**
- Signing in as each role shows the right sidebar
- Searching shows the time in ms
- Marcus Holloway's page matches the canvas
- Front Desk can't see labs, in either the page or the API
- Views appear in the audit log

### Step 6: Intake (9h)

**Build:**
- 8 sample files in `public/samples/`: 5 intake forms and 3 referral letters (one matching an existing patient, one for a new patient, one missing details)
- The upload and extraction API with the zod schemas
- Flag rules for expired and missing details
- The review screen
- Approve to create a patient, or attach a referral to a matching one
- Approval blocked when fields are missing

**Deliverables:**
- All 8 files extract correctly
- The three demo cases behave as designed
- Nothing is saved before approval
- Clinicians are blocked from Intake

### Step 7: Follow-up tasks (4h)

**Build:**
- `lib/follow-ups.ts`: an out-of-range lab creates a task with an assignee and a due date 2 days later
- The Tasks screen with summary cards, filters and source labels
- The Admin view of all tasks with assignees
- The "Automatic follow-ups" panel

**Deliverables:**
- Adding an out-of-range lab result creates a task by itself
- Each role sees the right list
- The counts match the Dashboard

### Step 8: Assistant (12h)

**Build:**
- `lib/ai/model.ts`
- The system prompt with the refusal rules
- Tools (get labs, get wearables, get medications), limited to the current patient and the user's role
- The evidence library: public health pages in `data/evidence/`, plus `scripts/build-evidence.ts` to chunk and embed them, and pgvector retrieval
- The streaming chat API
- The floating, draggable panel with source links

**Deliverables:**
- The blood sugar question returns the right numbers with links to the exact lab results
- The medication question is declined
- Asking about another patient is refused
- Front Desk can't open the assistant
- Every question is logged

### Step 9: Tests (6h)

**Build:**
- `tests/cases.json` with 30–50 cases across the five categories (numbers, sources, refusals, data leaks, role rules), each with its expected behaviour
- `scripts/run-tests.ts`, which saves the results
- The public Tests page reading the last run

**Deliverables:**
- One command runs every test
- The Tests page shows real results, with failures explained
- The page opens without signing in

### Step 10: Admin (4h)

**Build:**
- The audit log viewer with filters, including blocked attempts
- Role management
- The de-identified export (names removed, birth years only, dates shifted) with the preview row

**Deliverables:**
- The audit log shows real events from Steps 5–8
- The export downloads with no names, and with birth years and shifted dates
- Only Admins can open the screen

### Step 11: Dashboard (3h)

**Build:** The role-based number cards, the patient spotlight and the urgent tasks panel, all from real data.

**Deliverables:**
- Every number matches the screen it links to
- The spotlight shows the most urgent patient
- Front Desk sees the locked lab box

### Step 12: Polish, deploy and demo (4h)

**Build:**
- Check the phone layout
- Loading and error messages
- A full run-through on the live site three times
- The silent demo video and the Upwork card

**Deliverables:**
- Three clean runs in a row on production
- The demo video recorded and linked
- The Upwork portfolio card published

### If time runs short

Cut in this order:

1. Wearables
2. The dashboard (land on the Patient page instead)
3. Automatic follow-up tasks

Keep tests, roles and the audit log, since those are what the healthcare jobs care about most.
