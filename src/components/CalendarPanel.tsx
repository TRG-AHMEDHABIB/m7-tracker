'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase, type Task } from '@/lib/supabase';
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths,
} from 'date-fns';

interface DayAgg {
  date: string;
  total: number;
  done: number;
  totalMin: number;
  doneMin: number;
}

const PLAN_START = parseISO('2026-05-25');
const PLAN_END = parseISO('2026-08-22');

export default function CalendarPanel({
  currentDate,
  setCurrentDate,
}: {
  currentDate: string;
  setCurrentDate: (s: string) => void;
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(parseISO(currentDate)));
  const [aggs, setAggs] = useState<Record<string, DayAgg>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>(currentDate);
  const [dayTasks, setDayTasks] = useState<Task[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const gridStart = useMemo(() => startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }), [cursor]);
  const gridEnd = useMemo(() => endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }), [cursor]);
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);

  // Load aggregates for the visible grid
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const from = format(gridStart, 'yyyy-MM-dd');
      const to = format(gridEnd, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('tasks')
        .select('task_date, done, minutes')
        .gte('task_date', from)
        .lte('task_date', to);
      if (cancelled) return;
      if (!error && data) {
        const map: Record<string, DayAgg> = {};
        for (const row of data as Array<{ task_date: string; done: boolean; minutes: number }>) {
          const k = row.task_date;
          if (!map[k]) map[k] = { date: k, total: 0, done: 0, totalMin: 0, doneMin: 0 };
          map[k].total += 1;
          map[k].totalMin += row.minutes ?? 0;
          if (row.done) {
            map[k].done += 1;
            map[k].doneMin += row.minutes ?? 0;
          }
        }
        setAggs(map);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [gridStart, gridEnd]);

  // Load tasks for the selected day
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setDayLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('task_date', selected)
        .order('sort_order');
      if (cancelled) return;
      if (!error && data) setDayTasks(data as Task[]);
      else setDayTasks([]);
      setDayLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [selected]);

  // Load thresholds (median totalMin) for heatmap coloring
  const loadScale = useMemo(() => {
    const mins = Object.values(aggs).map(a => a.totalMin).filter(m => m > 0).sort((a, b) => a - b);
    if (mins.length === 0) return { light: 30, heavy: 90 };
    const q1 = mins[Math.floor(mins.length * 0.33)];
    const q3 = mins[Math.floor(mins.length * 0.66)];
    return { light: q1, heavy: q3 };
  }, [aggs]);

  function bucketClass(min: number): string {
    if (min === 0) return 'bg-paper';
    if (min <= loadScale.light) return 'bg-ink/[0.06]';
    if (min <= loadScale.heavy) return 'bg-ink/[0.14]';
    return 'bg-ink/[0.24]';
  }

  const monthLabel = format(cursor, 'MMMM yyyy');
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
      <div>
        <div className="mb-6 flex items-baseline justify-between border-b border-ink/15 pb-4">
          <h2 className="font-display text-4xl font-extrabold">{monthLabel}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCursor(subMonths(cursor, 1))}
              className="border border-ink/20 px-3 py-1.5 text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
            >← Prev</button>
            <button
              onClick={() => setCursor(startOfMonth(new Date()))}
              className="border border-ink/20 px-3 py-1.5 text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
            >Today</button>
            <button
              onClick={() => setCursor(addMonths(cursor, 1))}
              className="border border-ink/20 px-3 py-1.5 text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
            >Next →</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-ink/15 border border-ink/15">
          {weekdayLabels.map(d => (
            <div key={d} className="bg-paper px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted font-mono text-center">
              {d}
            </div>
          ))}
          {days.map(d => {
            const key = format(d, 'yyyy-MM-dd');
            const agg = aggs[key];
            const inMonth = isSameMonth(d, cursor);
            const inPlan = d >= PLAN_START && d <= PLAN_END;
            const isToday = isSameDay(d, new Date());
            const isSelected = key === selected;
            const totalMin = agg?.totalMin ?? 0;
            const total = agg?.total ?? 0;
            const done = agg?.done ?? 0;
            const allDone = total > 0 && done === total;

            return (
              <button
                key={key}
                onClick={() => { setSelected(key); setCurrentDate(key); }}
                className={`relative text-left p-2 min-h-[88px] transition-colors ${bucketClass(totalMin)} ${
                  inMonth ? '' : 'opacity-40'
                } ${isSelected ? 'ring-2 ring-accent ring-inset z-10' : ''} ${
                  isToday ? 'outline outline-2 outline-ink outline-offset-[-2px]' : ''
                } hover:bg-ink/10`}
              >
                <div className="flex items-baseline justify-between">
                  <span className={`tag-num text-sm ${isToday ? 'font-bold' : ''}`}>
                    {format(d, 'd')}
                  </span>
                  {inPlan && total > 0 && (
                    <span className="text-[9px] font-mono text-muted">
                      {Math.round(totalMin)}m
                    </span>
                  )}
                </div>
                {total > 0 && (
                  <div className="mt-2 flex flex-wrap gap-0.5">
                    {Array.from({ length: total }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          i < done ? 'bg-ink' : 'bg-ink/25'
                        }`}
                      />
                    ))}
                  </div>
                )}
                {allDone && (
                  <div className="absolute bottom-1 right-1.5 text-[10px] font-mono text-accent">✓</div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-4 text-[10px] uppercase tracking-widest font-mono text-muted">
          <span>Load:</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-paper border border-ink/15" /> none</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-ink/[0.06] border border-ink/15" /> light</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-ink/[0.14] border border-ink/15" /> normal</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-ink/[0.24] border border-ink/15" /> heavy</span>
          <span className="ml-4">●&nbsp;done&nbsp;&nbsp;○&nbsp;pending</span>
          {loading && <span className="ml-auto">loading…</span>}
        </div>
      </div>

      <aside className="border border-ink/20 p-5 h-fit">
        <div className="border-b border-ink/15 pb-3 mb-4">
          <div className="text-xs uppercase tracking-widest text-muted font-mono">Selected</div>
          <div className="font-display text-2xl font-bold mt-1">
            {format(parseISO(selected), 'EEE, MMM d')}
          </div>
          {dayTasks[0]?.week_label && (
            <div className="text-xs font-mono text-muted mt-1">
              {dayTasks[0].week_label}{dayTasks[0].day_label ? ` · ${dayTasks[0].day_label}` : ''}
            </div>
          )}
        </div>

        {dayLoading ? (
          <div className="text-muted text-sm">Loading…</div>
        ) : dayTasks.length === 0 ? (
          <div className="text-muted text-sm">No tasks scheduled.</div>
        ) : (
          <>
            <ul className="space-y-2">
              {dayTasks.map(t => (
                <li key={t.id} className="flex items-start gap-2 text-sm">
                  <span className={`mt-1 w-3 h-3 border flex-shrink-0 flex items-center justify-center text-[8px] ${
                    t.done ? 'bg-ink border-ink text-paper' : 'border-ink/40'
                  }`}>{t.done ? '✓' : ''}</span>
                  <div className="flex-1 min-w-0">
                    <div className={t.done ? 'line-through text-muted' : ''}>
                      {t.icon} {t.task_text}
                    </div>
                    <div className="text-[10px] font-mono text-muted mt-0.5">
                      {t.task_type} · {t.minutes}m
                      {t.rescheduled_count > 0 && ` · moved ×${t.rescheduled_count}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setCurrentDate(selected)}
              className="mt-5 w-full border-2 border-ink px-3 py-2 text-xs uppercase tracking-widest font-medium hover:bg-ink hover:text-paper transition-colors"
            >
              Open in Today tab →
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
