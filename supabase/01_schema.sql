-- ============================================================
-- Operation M7 — GRE Prep Tracker · Schema
-- Single-user app (no auth required, but RLS-ready)
-- ============================================================

-- Drop existing (idempotent re-runs)
drop table if exists error_log cascade;
drop table if exists tasks cascade;
drop table if exists weekly_goals cascade;
drop table if exists practice_tests cascade;
drop table if exists quant_topics cascade;
drop type if exists phase_t cascade;
drop type if exists section_t cascade;
drop type if exists question_type_t cascade;
drop type if exists task_type_t cascade;

-- ============================================================
-- Enums
-- ============================================================
create type phase_t as enum ('Foundation','Strategy','Practice','Execution','Test Week');
create type section_t as enum ('Quant','Verbal');
create type task_type_t as enum ('SETUP','VIDEO','PRACTICE','MEMORIZE','VOCAB','REVIEW','TEST','REST');
create type question_type_t as enum (
  -- Quant
  'Arithmetic','Algebra','Geometry','Word Problem','Data Analysis','Quantitative Comparison',
  -- Verbal
  'Text Completion','Sentence Equivalence','Reading Comprehension','Critical Reasoning'
);

-- ============================================================
-- Tasks: the day-by-day plan
-- ============================================================
create table tasks (
  id uuid primary key default gen_random_uuid(),
  task_date date not null,
  week_label text not null,         -- 'W1'..'W13'
  day_label text,                   -- 'Memorial Day', 'Work day', etc.
  icon text,
  task_text text not null,
  minutes int not null,
  task_type task_type_t not null,
  sort_order int not null,          -- order within day
  -- writeback fields
  done boolean not null default false,
  done_at timestamptz,
  actual_minutes int,
  notes text,
  -- smart-reschedule support
  original_date date,               -- preserves where it was scheduled originally
  rescheduled_count int not null default 0,
  created_at timestamptz default now()
);
create index on tasks (task_date);
create index on tasks (week_label);
create index on tasks (done, task_date);

-- ============================================================
-- Weekly goals & rollup
-- ============================================================
create table weekly_goals (
  week_label text primary key,
  dates_label text not null,
  focus text,
  phase phase_t,
  hours_target numeric,
  quant_q_target int,
  verbal_q_target int,
  vocab_target int,
  notes text,
  -- weekly reflection writeback
  reflection text,
  reflection_at timestamptz
);

-- ============================================================
-- Practice tests
-- ============================================================
create table practice_tests (
  id uuid primary key default gen_random_uuid(),
  test_label text not null,                -- 'Baseline','Test #1', ..., 'REAL'
  scheduled_date_label text,
  taken_date date,
  source text,
  verbal_score int,
  quant_score int,
  total_score int generated always as (coalesce(verbal_score,0) + coalesce(quant_score,0)) stored,
  top_weaknesses text,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- Quant topics checklist
-- ============================================================
create table quant_topics (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null,
  category text not null,
  topic text not null,
  notes text,
  studied boolean not null default false,
  drilled boolean not null default false,
  mastered boolean not null default false
);

-- ============================================================
-- THE ERROR LOG — the heart of the system
-- ============================================================
create table error_log (
  id uuid primary key default gen_random_uuid(),
  logged_at timestamptz not null default now(),
  -- WHEN
  question_date date not null default current_date,
  week_label text,
  -- WHAT
  section section_t not null,
  question_type question_type_t not null,
  topic text,                       -- free-text: 'triangle inequality', 'pivot words', etc.
  difficulty text,                  -- 'Easy' | 'Medium' | 'Hard'
  -- WHERE (the source)
  source text not null,             -- 'Manhattan 5lb','Gregmat','ETS PP1','ETS PP+1','Magoosh',etc.
  source_ref text,                  -- 'Ch.3 Q47', 'Group 12 word 8', 'Section 1 Q12'
  -- THE MISTAKE
  what_i_did_wrong text not null,
  fix_lesson text not null,
  time_spent_seconds int,
  -- RE-ATTEMPT (Sunday review loop)
  reattempted boolean not null default false,
  reattempted_at timestamptz,
  reattempt_correct boolean,        -- null = not yet; true/false after attempt
  -- TAGS for pivot analysis
  tags text[] default '{}',         -- ['careless','timing','knowledge-gap','trap']
  is_repeat_pattern boolean not null default false  -- mark when same mistake appears 2nd+ time
);
create index on error_log (question_date desc);
create index on error_log (section, question_type);
create index on error_log (source);
create index on error_log (is_repeat_pattern);

-- ============================================================
-- Views for the dashboard (pivot-table substitutes)
-- ============================================================

-- Errors by source × section
create or replace view v_errors_by_source as
select source, section, count(*) as error_count
from error_log
group by source, section
order by error_count desc;

-- Errors by question type (the weak-spot finder)
create or replace view v_errors_by_type as
select section, question_type,
       count(*) as total_errors,
       count(*) filter (where is_repeat_pattern) as repeat_errors,
       count(*) filter (where reattempted and reattempt_correct = false) as failed_reattempts,
       round(100.0 * count(*) filter (where reattempted and reattempt_correct) / nullif(count(*) filter (where reattempted),0), 1) as reattempt_success_pct
from error_log
group by section, question_type
order by total_errors desc;

-- Errors over time (trajectory)
create or replace view v_errors_by_week as
select date_trunc('week', question_date)::date as week_start,
       section,
       count(*) as errors
from error_log
group by 1, 2
order by 1, 2;

-- Daily progress rollup
create or replace view v_daily_progress as
select task_date,
       week_label,
       count(*) as tasks_total,
       count(*) filter (where done) as tasks_done,
       sum(minutes) as minutes_planned,
       sum(coalesce(actual_minutes, case when done then minutes else 0 end)) as minutes_done,
       round(100.0 * count(*) filter (where done) / count(*), 0) as pct_done
from tasks
group by task_date, week_label
order by task_date;

-- Weekly actuals (against goals)
create or replace view v_weekly_progress as
select w.week_label,
       w.dates_label,
       w.focus,
       w.phase,
       w.hours_target,
       round(coalesce(sum(t.actual_minutes), sum(case when t.done then t.minutes else 0 end))::numeric / 60, 1) as hours_done,
       w.quant_q_target,
       w.verbal_q_target,
       w.vocab_target,
       count(distinct t.task_date) filter (where t.done) as days_active
from weekly_goals w
left join tasks t on t.week_label = w.week_label
group by w.week_label, w.dates_label, w.focus, w.phase, w.hours_target,
         w.quant_q_target, w.verbal_q_target, w.vocab_target
order by w.week_label;

-- ============================================================
-- SMART RESCHEDULE: protects phase boundaries, redistributes within phase
-- ============================================================
-- When called with a missed_date, this function moves all incomplete tasks
-- from that date forward into the next available days WITHIN the same phase,
-- balancing total daily minutes so no single day exceeds 1.5x the average.
-- Test Day (Aug 22) is never touched.
-- ============================================================
create or replace function smart_reschedule(missed_date date)
returns table (moved_task_id uuid, from_date date, to_date date, task_text text)
language plpgsql
as $$
declare
  v_week text;
  v_phase phase_t;
  v_phase_end date;
  v_avg_minutes numeric;
  v_max_minutes numeric;
  rec record;
  target_date date;
  target_load int;
begin
  -- Find the phase for the missed date
  select t.week_label, w.phase
    into v_week, v_phase
  from tasks t
  join weekly_goals w on w.week_label = t.week_label
  where t.task_date = missed_date
  limit 1;

  if v_phase is null then
    return; -- nothing to do
  end if;

  -- Find last date in this phase (don't push past phase boundary)
  select max(t.task_date) into v_phase_end
  from tasks t join weekly_goals w on w.week_label = t.week_label
  where w.phase = v_phase;

  -- Compute average daily load within the remaining phase window
  select avg(daily_min) into v_avg_minutes from (
    select task_date, sum(minutes) as daily_min
    from tasks
    where task_date > missed_date and task_date <= v_phase_end and done = false
    group by task_date
  ) sub;
  v_max_minutes := coalesce(v_avg_minutes, 120) * 1.5;

  -- For each undone task on the missed date, find the next day in-phase with capacity
  for rec in
    select id, task_text, minutes
    from tasks
    where task_date = missed_date and done = false
    order by sort_order
  loop
    target_date := missed_date;
    loop
      target_date := target_date + 1;
      exit when target_date > v_phase_end; -- phase boundary reached
      -- skip TEST DAY (Aug 22) and any test-week REST days
      if exists (select 1 from tasks where task_date = target_date and task_type = 'TEST') then
        continue;
      end if;
      select coalesce(sum(minutes),0) into target_load
        from tasks where task_date = target_date;
      if target_load + rec.minutes <= v_max_minutes then
        update tasks
          set original_date = coalesce(original_date, task_date),
              task_date = target_date,
              rescheduled_count = rescheduled_count + 1
          where id = rec.id;
        moved_task_id := rec.id;
        from_date := missed_date;
        to_date := target_date;
        task_text := rec.task_text;
        return next;
        exit;
      end if;
    end loop;
    -- if we hit phase boundary, redistribute anyway (last days carry the load)
    if target_date > v_phase_end then
      update tasks
        set original_date = coalesce(original_date, task_date),
            task_date = v_phase_end,
            rescheduled_count = rescheduled_count + 1
        where id = rec.id;
      moved_task_id := rec.id;
      from_date := missed_date;
      to_date := v_phase_end;
      task_text := rec.task_text;
      return next;
    end if;
  end loop;
end;
$$;

-- ============================================================
-- CAP A BUSY DAY: cap a given day at N minutes, push the rest into next 2-3 days
-- ============================================================
-- Use for "tomorrow is a big work day" — set a cap (e.g. 30 min), tasks beyond
-- that cap get redistributed to the next 2-3 weekdays within the same phase.
-- Skips Fridays (rest), test days, and the test-day cap of 30 won't push onto
-- Saturday unless it's a non-test Saturday with capacity.
-- ============================================================
create or replace function cap_busy_day(busy_date date, cap_minutes int default 30, spread_days int default 3)
returns table (moved_task_id uuid, from_date date, to_date date, task_text text)
language plpgsql
as $$
declare
  v_phase phase_t;
  v_phase_end date;
  v_running int := 0;
  rec record;
  target_date date;
  candidate_date date;
  candidate_load int;
  best_date date;
  best_load int;
  days_searched int;
begin
  -- Find phase
  select w.phase into v_phase
  from tasks t join weekly_goals w on w.week_label = t.week_label
  where t.task_date = busy_date limit 1;

  if v_phase is null then return; end if;

  select max(t.task_date) into v_phase_end
  from tasks t join weekly_goals w on w.week_label = t.week_label
  where w.phase = v_phase;

  -- Walk tasks on busy_date in sort order, keeping until cap, displacing rest
  for rec in
    select id, task_text, minutes
    from tasks
    where task_date = busy_date and done = false
    order by sort_order
  loop
    if v_running + rec.minutes <= cap_minutes then
      -- Keep this task on the busy day
      v_running := v_running + rec.minutes;
    else
      -- Find best home in next `spread_days` valid days
      best_date := null;
      best_load := null;
      candidate_date := busy_date;
      days_searched := 0;
      while days_searched < (spread_days * 2) and candidate_date <= v_phase_end loop
        candidate_date := candidate_date + 1;
        -- Skip Friday (rest day) and any day with a TEST
        if extract(dow from candidate_date) = 5 then continue; end if;
        if exists (select 1 from tasks where task_date = candidate_date and task_type = 'TEST') then continue; end if;
        -- Don't push onto a light Saturday unless it would still stay under 60 min
        if extract(dow from candidate_date) = 6 and not exists (
          select 1 from tasks where task_date = candidate_date and task_type = 'TEST'
        ) then
          if (select coalesce(sum(minutes),0) from tasks where task_date = candidate_date) + rec.minutes > 60 then
            continue;
          end if;
        end if;
        days_searched := days_searched + 1;
        select coalesce(sum(minutes),0) into candidate_load
          from tasks where task_date = candidate_date;
        if best_load is null or candidate_load < best_load then
          best_date := candidate_date;
          best_load := candidate_load;
        end if;
        exit when days_searched >= spread_days;
      end loop;

      if best_date is not null then
        update tasks
          set original_date = coalesce(original_date, task_date),
              task_date = best_date,
              rescheduled_count = rescheduled_count + 1
          where id = rec.id;
        moved_task_id := rec.id;
        from_date := busy_date;
        to_date := best_date;
        task_text := rec.task_text;
        return next;
      end if;
    end if;
  end loop;
end;
$$;

-- ============================================================
-- IMPORT TASKS FROM JSON: replace the daily plan from a GPT-generated plan
-- ============================================================
-- Accepts a JSON array of task objects. Wipes existing tasks (preserving
-- done-state for unchanged tasks via the unique constraint on
-- (task_date, sort_order)), then re-inserts. Use to swap in a revised plan.
-- ============================================================
create or replace function import_tasks_from_json(plan jsonb, preserve_done boolean default true)
returns int
language plpgsql
as $$
declare
  v_count int := 0;
  v_done_map jsonb;
begin
  if preserve_done then
    -- Capture current done-state keyed by (date, sort_order)
    select coalesce(jsonb_object_agg(task_date::text || ':' || sort_order::text,
                                     jsonb_build_object('done', done, 'actual_minutes', actual_minutes, 'notes', notes)), '{}'::jsonb)
      into v_done_map
    from tasks where done = true;
  else
    v_done_map := '{}'::jsonb;
  end if;

  -- Wipe and re-insert
  delete from tasks;

  insert into tasks (task_date, week_label, day_label, icon, task_text, minutes, task_type, sort_order, done, actual_minutes, notes)
  select
    (t->>'task_date')::date,
    t->>'week_label',
    t->>'day_label',
    t->>'icon',
    t->>'task_text',
    (t->>'minutes')::int,
    (t->>'task_type')::task_type_t,
    (t->>'sort_order')::int,
    coalesce((v_done_map -> ((t->>'task_date') || ':' || (t->>'sort_order')) ->> 'done')::boolean, false),
    nullif(v_done_map -> ((t->>'task_date') || ':' || (t->>'sort_order')) ->> 'actual_minutes', '')::int,
    v_done_map -> ((t->>'task_date') || ':' || (t->>'sort_order')) ->> 'notes'
  from jsonb_array_elements(plan) as t;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================
-- EXPORT TASKS AS JSON: get the current plan as a JSON array (for GPT round-trip)
-- ============================================================
create or replace function export_tasks_as_json()
returns jsonb
language sql
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'task_date', task_date,
      'week_label', week_label,
      'day_label', day_label,
      'icon', icon,
      'task_text', task_text,
      'minutes', minutes,
      'task_type', task_type,
      'sort_order', sort_order
    ) order by task_date, sort_order
  ), '[]'::jsonb) from tasks;
$$;

-- ============================================================
-- Mark repeat patterns automatically (call from app on insert)
-- ============================================================
create or replace function flag_repeat_patterns()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from error_log
    where section = new.section
      and question_type = new.question_type
      and topic is not distinct from new.topic
      and id <> new.id
  ) then
    new.is_repeat_pattern := true;
  end if;
  return new;
end;
$$;

create trigger trg_flag_repeat
  before insert or update on error_log
  for each row execute function flag_repeat_patterns();

-- ============================================================
-- Row-Level Security (single-user, but enabled defensively)
-- ============================================================
alter table tasks enable row level security;
alter table weekly_goals enable row level security;
alter table practice_tests enable row level security;
alter table quant_topics enable row level security;
alter table error_log enable row level security;

-- Public read+write policies (single-user; tighten if you add auth later)
create policy "open" on tasks for all using (true) with check (true);
create policy "open" on weekly_goals for all using (true) with check (true);
create policy "open" on practice_tests for all using (true) with check (true);
create policy "open" on quant_topics for all using (true) with check (true);
create policy "open" on error_log for all using (true) with check (true);
