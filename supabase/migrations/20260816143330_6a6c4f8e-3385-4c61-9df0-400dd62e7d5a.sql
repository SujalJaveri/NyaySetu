
-- 1. Category
insert into public.case_categories (name, typical_duration_minutes, urgency_weight)
values ('Commercial Dispute', 60, 95)
on conflict do nothing;

-- 2. Judge + courtroom from the demo scenario
insert into public.judges (name, specialisation, current_workload)
select 'Hon. Anjali Rao', 'Commercial Law', 4
where not exists (select 1 from public.judges where name = 'Hon. Anjali Rao');

insert into public.courtrooms (name, capacity, type, current_allocation)
select 'Courtroom 3', 40, 'general', 0
where not exists (select 1 from public.courtrooms where name = 'Courtroom 3');

-- Existing commercial judge already carries a heavier docket
update public.judges set current_workload = 9 where name = 'Hon. Nikhil Barua';

-- 3. Case CASE-2026-0012
update public.cases c
set category_id = (select id from public.case_categories where name = 'Commercial Dispute'),
    filing_date = current_date - 52,
    pending_duration_days = 52,
    previous_adjournments = 1,
    estimated_duration_minutes = 60,
    status = 'filed'
where c.case_number = 'CASE-2026-0012';

insert into public.adjournments (case_id, reason)
select c.id, 'Counsel for the respondent sought time to file a reply affidavit.'
from public.cases c
where c.case_number = 'CASE-2026-0012'
  and not exists (select 1 from public.adjournments a where a.case_id = c.id);

-- 4. Give Annexe Hall a booking so courtroom utilisation is meaningfully differentiated
insert into public.schedules (case_id, judge_id, courtroom_id, slot_id, status)
select c.id, j.id, r.id, s.id, 'confirmed'
from public.cases c,
     public.judges j,
     public.courtrooms r,
     (select id from public.hearing_slots where date >= current_date order by date desc, start_time desc limit 1) s
where c.case_number = 'CASE-2026-0014'
  and j.name = 'Hon. Samir Vaidya'
  and r.name = 'Annexe Hall'
  and not exists (select 1 from public.schedules x where x.case_id = c.id and x.status in ('proposed','confirmed'));

update public.cases set status = 'scheduled' where case_number = 'CASE-2026-0014';
update public.courtrooms set current_allocation = current_allocation + 1 where name = 'Annexe Hall';
update public.judges set current_workload = current_workload + 1 where name = 'Hon. Samir Vaidya';

-- 5. Sharpen the configurable caps so ageing and repeat adjournments register properly
update public.priority_settings set pending_cap_days = 60, adjournment_cap = 2;

-- 6. Recompute every priority score with the same deterministic formula the app uses
update public.cases c
set priority_score = round((
      ps.category_weight * (coalesce(cat.urgency_weight, 50) / 100.0)
    + ps.pending_weight  * least(1.0, greatest(0.0, (current_date - c.filing_date)::numeric / greatest(1, ps.pending_cap_days)))
    + ps.adjournment_weight * least(1.0, c.previous_adjournments::numeric / greatest(1, ps.adjournment_cap))
    + case when c.legal_priority_flag then ps.boost_points else 0 end
    )::numeric, 1),
    pending_duration_days = greatest(0, current_date - c.filing_date)
from public.priority_settings ps
left join lateral (select 1) dummy on true
left join public.case_categories cat on true
where cat.id is not distinct from c.category_id;
