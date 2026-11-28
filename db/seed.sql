-- Sample staff tasks for the demo (Step 7). There's no "Add task" screen in the
-- designs, so these stand in for tasks staff would have added. Run by
-- `npm run db:seed`, which sets carebase.today (the clinic's date) and
-- carebase.tz (CLINIC_TIMEZONE) first. Safe to run more than once: a task with
-- the same patient and title is never added twice.
-- (Demo accounts are seeded by scripts/apply-schema.ts; lab tasks by npm run db:follow-ups.)

WITH clinic AS (
  SELECT current_setting('carebase.today')::date AS today,
         current_setting('carebase.today')::date - (extract(isodow FROM current_setting('carebase.today')::date)::int - 1) AS monday,
         current_setting('carebase.tz') AS tz
),
seed (mrn, title, detail, due_offset, assignee_email, created_by_email, done_days_ago) AS (VALUES
  ('91934', 'Call to book a follow-up visit',                  'Requested after a lab review',     -1, 'frontdesk@carebase.demo', 'clinician@carebase.demo', NULL::int),
  ('94087', 'Call to book a follow-up visit',                  'Requested after a lab review',      0, 'frontdesk@carebase.demo', 'clinician@carebase.demo', NULL),
  ('73903', 'Ask for an updated insurance card',               'No insurance card on file',         0, 'frontdesk@carebase.demo', 'admin@carebase.demo',     NULL),
  ('76057', 'Confirm referral from Riverside Family Practice', 'Referral letter waiting in Intake',  1, 'frontdesk@carebase.demo', 'frontdesk@carebase.demo', NULL),
  ('11287', 'Call to book a follow-up visit',                  'Requested after a lab review',      4, 'frontdesk@carebase.demo', 'clinician@carebase.demo', NULL),
  -- Done earlier this week, so "Done this week" isn't empty on day one.
  ('16696', 'Send new-patient forms',                          'Sent by email',                    -1, 'frontdesk@carebase.demo', 'frontdesk@carebase.demo', 2),
  ('98096', 'Update phone number on record',                   'Patient called with a new number',  0, 'frontdesk@carebase.demo', 'frontdesk@carebase.demo', 1)
)
INSERT INTO tasks (patient_id, title, detail, source, assignee_id, created_by_id, due_on, status, completed_at, created_at)
SELECT p.id, s.title, s.detail, 'staff', a.id, c.id, clinic.today + s.due_offset,
       CASE WHEN s.done_days_ago IS NULL THEN 'open' ELSE 'done' END,
       -- Never before Monday 9:00 at the clinic, never in the future.
       CASE WHEN s.done_days_ago IS NULL THEN NULL
            ELSE least(now(), greatest((clinic.monday + time '09:00') AT TIME ZONE clinic.tz, now() - make_interval(days => s.done_days_ago)))
       END,
       now() - interval '3 days'
FROM seed s
CROSS JOIN clinic
JOIN patients p ON p.mrn = s.mrn
JOIN accounts a ON a.email = s.assignee_email
JOIN accounts c ON c.email = s.created_by_email
WHERE NOT EXISTS (
  SELECT 1 FROM tasks t WHERE t.patient_id = p.id AND t.title = s.title AND t.source = 'staff'
);
