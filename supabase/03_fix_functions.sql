-- ============================================================
-- PATCH: Fix ambiguous column + add undo_reschedule
-- Run this in Supabase SQL Editor — safe, no data is dropped
-- ============================================================

-- FIX 1: smart_reschedule — rename return col task_text → moved_task_text
create or replace function smart_reschedule(missed_date date)
returns table (moved_task_id uuid, from_date date, to_date date, moved_task_text text)
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
  select t.week_label, w.phase
    into v_week, v_phase
  from tasks t
  join weekly_goals w on w.week_label = t.week_label
  where t.task_date = missed_date
  limit 1;

  if v_phase is null then return; end if;

  select max(t.task_date) into v_phase_end
  from tasks t join weekly_goals w on w.week_label = t.week_label
  where w.phase = v_phase;

  select avg(daily_min) into v_avg_minutes from (
    select task_date, sum(minutes) as daily_min
    from tasks
    where task_date > missed_date and task_date <= v_phase_end and done = false
    group by task_date
  ) sub;
  v_max_minutes := coalesce(v_avg_minutes, 120) * 1.5;

  for rec in
    select id, task_text as txt, minutes
    from tasks
    where task_date = missed_date and done = false
    order by sort_order
  loop
    target_date := missed_date;
    loop
      target_date := target_date + 1;
      exit when target_date > v_phase_end;
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
        moved_task_text := rec.txt;
        return next;
        exit;
      end if;
    end loop;
    if target_date > v_phase_end then
      update tasks
        set original_date = coalesce(original_date, task_date),
            task_date = v_phase_end,
            rescheduled_count = rescheduled_count + 1
        where id = rec.id;
      moved_task_id := rec.id;
      from_date := missed_date;
      to_date := v_phase_end;
      moved_task_text := rec.txt;
      return next;
    end if;
  end loop;
end;
$$;

-- FIX 2: cap_busy_day — same rename
create or replace function cap_busy_day(busy_date date, cap_minutes int default 30, spread_days int default 3)
returns table (moved_task_id uuid, from_date date, to_date date, moved_task_text text)
language plpgsql
as $$
declare
  v_phase phase_t;
  v_phase_end date;
  v_running int := 0;
  rec record;
  candidate_date date;
  candidate_load int;
  best_date date;
  best_load int;
  days_searched int;
begin
  select w.phase into v_phase
  from tasks t join weekly_goals w on w.week_label = t.week_label
  where t.task_date = busy_date limit 1;

  if v_phase is null then return; end if;

  select max(t.task_date) into v_phase_end
  from tasks t join weekly_goals w on w.week_label = t.week_label
  where w.phase = v_phase;

  for rec in
    select id, task_text as txt, minutes
    from tasks
    where task_date = busy_date and done = false
    order by sort_order
  loop
    if v_running + rec.minutes <= cap_minutes then
      v_running := v_running + rec.minutes;
    else
      best_date := null;
      best_load := null;
      candidate_date := busy_date;
      days_searched := 0;
      while days_searched < (spread_days * 2) and candidate_date <= v_phase_end loop
        candidate_date := candidate_date + 1;
        if extract(dow from candidate_date) = 5 then continue; end if;
        if exists (select 1 from tasks where task_date = candidate_date and task_type = 'TEST') then continue; end if;
        if extract(dow from candidate_date) = 6 then
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
        moved_task_text := rec.txt;
        return next;
      end if;
    end if;
  end loop;
end;
$$;

-- NEW: undo_reschedule — restore tasks that were moved away FROM a date back to it
create or replace function undo_reschedule(restore_date date)
returns int
language plpgsql
as $$
declare
  v_count int := 0;
begin
  update tasks
    set task_date = original_date,
        original_date = null,
        rescheduled_count = 0
  where original_date = restore_date
    and done = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
