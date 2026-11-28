-- Carebase schema. Safe to run more than once: `npm run db:schema`.
-- Role values must match ROLES in lib/access.ts.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- trigram indexes for patient name search

-- Demo accounts. The single source of truth for each account's role.
CREATE TABLE IF NOT EXISTS accounts (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  name       text NOT NULL,
  initials   text NOT NULL,
  role       text NOT NULL CHECK (role IN ('front_desk', 'clinician', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn                  text NOT NULL UNIQUE,
  first_name           text NOT NULL,
  last_name            text NOT NULL,
  birth_date           date NOT NULL,
  sex                  text CHECK (sex IN ('female', 'male', 'other')),
  phone                text,
  email                text,
  address              text,
  insurance_provider   text,
  insurance_member_id  text,
  insurance_expires_on date,
  source               text NOT NULL CHECK (source IN ('synthea', 'intake')),
  synthea_id           text UNIQUE,
  created_at           timestamptz NOT NULL DEFAULT now()
);
-- "Patients added this week" counts only source = 'intake'.
CREATE INDEX IF NOT EXISTS patients_source_created_idx ON patients (source, created_at);
-- Patient search: ILIKE '%term%' on the full name or the MRN.
CREATE INDEX IF NOT EXISTS patients_name_trgm_idx ON patients USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS patients_mrn_trgm_idx ON patients USING gin (mrn gin_trgm_ops);

CREATE TABLE IF NOT EXISTS visits (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id    uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  visited_at    timestamptz NOT NULL,
  kind          text,
  reason        text,
  provider_name text,
  synthea_id    text UNIQUE
);
CREATE INDEX IF NOT EXISTS visits_patient_idx ON visits (patient_id, visited_at DESC);

CREATE TABLE IF NOT EXISTS lab_results (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id  uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  visit_id    bigint REFERENCES visits (id) ON DELETE SET NULL,
  code        text NOT NULL,          -- LOINC
  name        text NOT NULL,
  value       numeric NOT NULL,
  unit        text NOT NULL,
  normal_low  numeric,
  normal_high numeric,
  taken_at    timestamptz NOT NULL,
  synthea_id  text UNIQUE,            -- set for imported results, so re-imports update in place
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lab_results_patient_code_idx ON lab_results (patient_id, code, taken_at DESC);
CREATE INDEX IF NOT EXISTS lab_results_taken_idx ON lab_results (taken_at);

CREATE TABLE IF NOT EXISTS medications (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  code       text,                   -- RxNorm
  name       text NOT NULL,
  dose       text,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stopped')),
  started_on date,
  stopped_on date,
  synthea_id text UNIQUE              -- <patient id>:<RxNorm code>, one row per medication
);
CREATE INDEX IF NOT EXISTS medications_patient_idx ON medications (patient_id);

CREATE TABLE IF NOT EXISTS allergies (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id  uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  substance   text NOT NULL,
  reaction    text,
  severity    text CHECK (severity IN ('mild', 'moderate', 'severe')),
  recorded_on date,
  synthea_id  text UNIQUE
);
CREATE INDEX IF NOT EXISTS allergies_patient_idx ON allergies (patient_id);

CREATE TABLE IF NOT EXISTS conditions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id  uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  code        text,                  -- SNOMED
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  onset_on    date,
  resolved_on date,
  synthea_id  text UNIQUE
);
CREATE INDEX IF NOT EXISTS conditions_patient_idx ON conditions (patient_id);

CREATE TABLE IF NOT EXISTS wearable_readings (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id  uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('heart_rate', 'sleep_hours', 'steps')),
  value       numeric NOT NULL,
  unit        text NOT NULL,
  measured_on date NOT NULL,
  UNIQUE (patient_id, kind, measured_on)
);

CREATE TABLE IF NOT EXISTS tasks (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id    uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  title         text NOT NULL,
  detail        text,                -- staff: written by people; lab: the day's out-of-range results
  source        text NOT NULL CHECK (source IN ('lab', 'staff')),
  lab_result_id bigint UNIQUE REFERENCES lab_results (id) ON DELETE SET NULL,
  assignee_id   bigint NOT NULL REFERENCES accounts (id),
  created_by_id bigint REFERENCES accounts (id),
  due_on        date NOT NULL,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (source <> 'lab' OR lab_result_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks (assignee_id, status, due_on);
CREATE INDEX IF NOT EXISTS tasks_status_due_idx ON tasks (status, due_on);
-- Step 7: lab tasks are one per patient per lab day (the clinic-time-zone date of the results).
-- The unique index is what stops lib/follow-ups.ts creating duplicates.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lab_day date;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_lab_day_uniq ON tasks (patient_id, lab_day) WHERE source = 'lab';

CREATE TABLE IF NOT EXISTS intake_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           text NOT NULL CHECK (kind IN ('intake_form', 'referral_letter')),
  file_name      text NOT NULL,
  file_type      text NOT NULL,       -- MIME type
  file_data      bytea NOT NULL,
  extracted      jsonb NOT NULL DEFAULT '{}'::jsonb,
  flags          jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ field, kind: "missing" | "expired", message }]
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  patient_id     uuid REFERENCES patients (id) ON DELETE SET NULL,  -- set on approval
  uploaded_by_id bigint NOT NULL REFERENCES accounts (id),
  reviewed_by_id bigint REFERENCES accounts (id),
  uploaded_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_at    timestamptz
);
CREATE INDEX IF NOT EXISTS intake_documents_status_idx ON intake_documents (status, uploaded_at DESC);

-- No foreign keys: each row keeps who did what as it was at the time.
CREATE TABLE IF NOT EXISTS audit_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  account_email text NOT NULL,
  role          text NOT NULL CHECK (role IN ('front_desk', 'clinician', 'admin', 'system')),
  kind          text NOT NULL CHECK (kind IN ('view', 'change', 'blocked')),
  action        text NOT NULL,
  record_type   text NOT NULL,
  record_id     text,
  record_label  text,
  details       jsonb
);
-- 'system' is for automatic actions with no person behind them (follow-up tasks).
-- Re-applied so databases created before Step 7 accept it too.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_role_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_role_check CHECK (role IN ('front_desk', 'clinician', 'admin', 'system'));
CREATE INDEX IF NOT EXISTS audit_log_occurred_idx ON audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_kind_idx ON audit_log (kind, occurred_at DESC);

-- text-embedding-3-small returns 1536 dimensions.
CREATE TABLE IF NOT EXISTS evidence_chunks (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_title text NOT NULL,
  source_url   text NOT NULL,
  chunk_index  integer NOT NULL,
  content      text NOT NULL,
  embedding    vector(1536) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_url, chunk_index)
);
CREATE INDEX IF NOT EXISTS evidence_chunks_embedding_idx ON evidence_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS test_runs (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  model  text,
  total  integer NOT NULL,
  passed integer NOT NULL
);
CREATE INDEX IF NOT EXISTS test_runs_ran_idx ON test_runs (ran_at DESC);

CREATE TABLE IF NOT EXISTS test_results (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id   bigint NOT NULL REFERENCES test_runs (id) ON DELETE CASCADE,
  case_id  text NOT NULL,
  category text NOT NULL CHECK (category IN ('numbers', 'sources', 'refusals', 'data_leaks', 'role_rules')),
  question text NOT NULL,
  expected text NOT NULL,
  passed   boolean NOT NULL,
  actual   text,
  UNIQUE (run_id, case_id)
);

-- Step 9: the test runner signs in as separate test accounts, so test questions
-- never count towards the public assistant cap and the audit viewer can hide them.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
-- Which site a run tested (the Tests page shows the latest live run), how long it took, and its tokens.
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS base_url text;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS input_tokens integer;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS output_tokens integer;
CREATE INDEX IF NOT EXISTS test_runs_base_ran_idx ON test_runs (base_url, ran_at DESC);
-- Who the case is about, and in plain words which check failed.
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS patient text;
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS position integer;
