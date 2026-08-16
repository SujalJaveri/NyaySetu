INSERT INTO public.audit_logs (user_id, action, entity_affected, timestamp)
SELECT p.id, v.action, v.entity, now() - v.ago
FROM public.profiles p
CROSS JOIN (VALUES
  ('Registered case CASE-2026-0016', 'case:CASE-2026-0016', interval '9 days'),
  ('Registered case CASE-2026-0017', 'case:CASE-2026-0017', interval '8 days 4 hours'),
  ('Availability change — judge marked unavailable for all 6 slot(s) on 2026-08-18', 'judge:Hon. Aruna Sethi', interval '7 days'),
  ('Accepted AI Recommendation — listing created', 'case:CASE-2026-0002 schedule:seeded', interval '6 days 2 hours'),
  ('Accepted AI Recommendation — listing created', 'case:CASE-2026-0005 schedule:seeded', interval '5 days 6 hours'),
  ('Modified AI Recommendation (chose an alternative valid slot) — listing created', 'case:CASE-2026-0007 schedule:seeded', interval '4 days 3 hours'),
  ('Rejected AI Recommendation — no listing confirmed', 'case:CASE-2026-0011 schedule:seeded', interval '3 days 5 hours'),
  ('Availability change — courtroom marked unavailable for one slot on 2026-08-20', 'courtroom:Court Hall 2', interval '2 days 7 hours'),
  ('Applied legal/administrative priority boost on case CASE-2026-0013', 'case:CASE-2026-0013', interval '2 days'),
  ('Applied what-if simulation — Hon. Aruna Sethi marked unavailable on 2026-08-18; 2 hearing(s) reassigned', 'judge:Hon. Aruna Sethi date:2026-08-18', interval '1 day 4 hours'),
  ('Updated Priority Score settings', 'settings:priority_settings', interval '20 hours'),
  ('Registered case CASE-2026-0018', 'case:CASE-2026-0018', interval '6 hours')
) AS v(action, entity, ago)
WHERE p.full_name = 'sujaljaveri24';