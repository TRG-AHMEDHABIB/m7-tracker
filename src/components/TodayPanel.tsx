'use client';

import { useEffect, useState } from 'react';
import { supabase, type Task } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';

export default function TodayPanel({ currentDate }: { currentDate: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleResult, setRescheduleResult] = useState<string | null>(null);
  const [movedAwayCount, setMovedAwayCount] = useState(0);

  async function load() {
    setLoading(true);
    const [taskRes, movedRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('task_date', currentDate).order('sort_order'),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('original_date', currentDate).eq('done', false),
    ]);
    if (!taskRes.error && taskRes.data) setTasks(taskRes.data as Task[]);
    setMovedAwayCount(movedRes.count ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, [currentDate]);

  async function toggle(t: Task) {
    const newDone = !t.done;
    await supabase
      .from('tasks')
      .update({ done: newDone, done_at: newDone ? new Date().toISOString() : null })
      .eq('id', t.id);
    load();
  }

  async function updateActualMin(t: Task, mins: number) {
    await supabase.from('tasks').update({ actual_minutes: mins }).eq('id', t.id);
    load();
  }

  async function rescheduleMissed() {
    setRescheduling(true);
    const { data, error } = await supabase.rpc('smart_reschedule', { missed_date: currentDate });
    setRescheduling(false);
    if (error) {
      setRescheduleResult('Error: ' + error.message);
    } else {
      const count = data?.length ?? 0;
      setRescheduleResult(`${count} task${count === 1 ? '' : 's'} redistributed within phase.`);
    }
    setTimeout(() => setRescheduleResult(null), 5000);
    load();
  }

  async function undoReschedule() {
    setRescheduling(true);
    const { data, error } = await supabase.rpc('undo_reschedule', { restore_date: currentDate });
    setRescheduling(false);
    if (error) {
      setRescheduleResult('Error: ' + error.message);
    } else {
      setRescheduleResult(`${data} task${data === 1 ? '' : 's'} restored to ${currentDate}.`);
    }
    setTimeout(() => setRescheduleResult(null), 5000);
    load();
  }

  async function capBusyDay(capMin: number) {
    setRescheduling(true);
    const { data, error } = await supabase.rpc('cap_busy_day', {
      busy_date: currentDate, cap_minutes: capMin, spread_days: 3,
    });
    setRescheduling(false);
    if (error) {
      setRescheduleResult('Error: ' + error.message);
    } else {
      const count = data?.length ?? 0;
      setRescheduleResult(`Day capped at ${capMin} min. ${count} task${count === 1 ? '' : 's'} pushed to next ${count > 0 ? 'few days' : 'day(s) — already under cap'}.`);
    }
    setTimeout(() => setRescheduleResult(null), 6000);
    load();
  }

  const totalMin = tasks.reduce((s, t) => s + t.minutes, 0);
  const doneMin = tasks.filter(t => t.done).reduce((s, t) => s + t.minutes, 0);
  const pct = totalMin ? Math.round((doneMin / totalMin) * 100) : 0;
  const undoneCount = tasks.filter(t => !t.done).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
      <div>
        <div className="mb-6 flex items-baseline justify-between border-b border-ink/15 pb-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted font-mono">
              {tasks[0]?.week_label ?? ''} · {tasks[0]?.day_label ?? ''}
            </div>
            <h2 className="font-display text-4xl font-extrabold mt-1">
              {format(parseISO(currentDate), 'EEEE, MMMM d')}
            </h2>
          </div>
          <div className="text-right">
            <div className="tag-num text-5xl font-bold">{pct}<span className="text-2xl text-muted">%</span></div>
            <div className="text-xs uppercase tracking-widest text-muted font-mono">{doneMin}/{totalMin} min</div>
          </div>
        </div>

        {loading ? (
          <div className="text-muted">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="border-2 border-dashed border-ink/15 p-8 text-center">
            <div className="text-muted">No tasks scheduled for this date.</div>
            <div className="text-xs text-muted mt-2 font-mono">Try a date between May 25 — Aug 22, 2026.</div>
          </div>
        ) : (
          <ul className="space-y-3">
            {tasks.map(t => (
              <li
                key={t.id}
                className={`group border ${t.done ? 'border-ink/10 bg-ink/[0.02]' : 'border-ink/20'} p-4 transition-all`}
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => toggle(t)}
                    className={`mt-1 w-6 h-6 border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      t.done ? 'bg-ink border-ink' : 'border-ink/40 hover:border-ink'
                    }`}
                  >
                    {t.done && <span className="text-paper text-sm">✓</span>}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xl">{t.icon}</span>
                      <span className={`font-medium ${t.done ? 'line-through text-muted' : ''}`}>
                        {t.task_text}
                      </span>
                      {t.rescheduled_count > 0 && (
                        <span className="text-[10px] uppercase tracking-widest bg-accent text-paper px-1.5 py-0.5">
                          moved ×{t.rescheduled_count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted font-mono">
                      <span className="border border-ink/20 px-2 py-0.5 uppercase">{t.task_type}</span>
                      <span>{t.minutes} min</span>
                      {t.done && (
                        <ActualTimeField task={t} onSave={(mins) => updateActualMin(t, mins)} />
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sidebar — smart reschedule */}
      <aside className="space-y-6">
        <div className="border border-ink/20 p-5">
          <h3 className="font-display text-lg font-bold mb-3">Missed a day?</h3>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Smart-reschedule redistributes <span className="text-ink font-medium">undone</span> tasks across the rest of the current phase, capping daily load at 1.5× the phase average. Phase boundaries are protected. Test Day stays fixed.
          </p>
          <button
            onClick={rescheduleMissed}
            disabled={rescheduling || undoneCount === 0}
            className="w-full bg-ink text-paper px-4 py-3 text-sm uppercase tracking-widest font-medium disabled:opacity-30"
          >
            {rescheduling ? 'Redistributing…' : `Redistribute ${undoneCount} undone task${undoneCount === 1 ? '' : 's'}`}
          </button>
          {movedAwayCount > 0 && (
            <button
              onClick={undoReschedule}
              disabled={rescheduling}
              className="mt-2 w-full border border-ink/30 text-muted px-4 py-2 text-xs uppercase tracking-widest disabled:opacity-30 hover:border-ink hover:text-ink transition-colors"
            >
              {rescheduling ? 'Restoring…' : `↩ Restore ${movedAwayCount} task${movedAwayCount === 1 ? '' : 's'} moved from today`}
            </button>
          )}
          {rescheduleResult && (
            <div className="mt-3 text-xs font-mono text-accent">{rescheduleResult}</div>
          )}
        </div>

        <div className="border border-ink/20 p-5">
          <h3 className="font-display text-lg font-bold mb-3">Big work day coming?</h3>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Cap this day at <span className="text-ink font-medium">30 min</span>. The rest gets pushed to the lightest of the next 3 days, skipping Fridays (rest) and test days.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => capBusyDay(30)}
              disabled={rescheduling || tasks.length === 0}
              className="border-2 border-ink px-3 py-2 text-xs uppercase tracking-widest font-medium hover:bg-ink hover:text-paper transition-colors disabled:opacity-30"
            >
              Cap at 30 min
            </button>
            <button
              onClick={() => capBusyDay(60)}
              disabled={rescheduling || tasks.length === 0}
              className="border-2 border-ink px-3 py-2 text-xs uppercase tracking-widest font-medium hover:bg-ink hover:text-paper transition-colors disabled:opacity-30"
            >
              Cap at 60 min
            </button>
          </div>
        </div>

        <QuickErrorLog currentDate={currentDate} weekLabel={tasks[0]?.week_label} />
      </aside>
    </div>
  );
}

function ActualTimeField({ task, onSave }: { task: Task; onSave: (mins: number) => void }) {
  const [open, setOpen] = useState(false);
  if (task.actual_minutes) {
    return (
      <span
        className="text-accent cursor-pointer hover:underline"
        onClick={() => setOpen(o => !o)}
      >
        {open ? (
          <input
            type="number"
            autoFocus
            defaultValue={task.actual_minutes}
            onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v)) { onSave(v); setOpen(false); } }}
            className="w-14 bg-transparent border-b border-accent text-xs outline-none"
          />
        ) : `${task.actual_minutes} min actual`}
      </span>
    );
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="opacity-40 hover:opacity-80 transition-opacity">
        came in under?
      </button>
    );
  }
  return (
    <input
      type="number"
      autoFocus
      placeholder="actual min"
      onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v)) onSave(v); setOpen(false); }}
      onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
      className="w-20 bg-transparent border border-ink/20 px-2 py-0.5 text-xs outline-none"
    />
  );
}

// Quick error-log entry inline on Today panel
function QuickErrorLog({ currentDate, weekLabel }: { currentDate: string; weekLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="border border-ink/20 p-5">
      <h3 className="font-display text-lg font-bold mb-3">Just missed one?</h3>
      <p className="text-sm text-muted mb-4">Drop a quick error-log entry without leaving today.</p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full border-2 border-ink px-4 py-3 text-sm uppercase tracking-widest font-medium hover:bg-ink hover:text-paper transition-colors"
        >
          + Log a missed question
        </button>
      ) : (
        <QuickErrorForm
          currentDate={currentDate}
          weekLabel={weekLabel}
          onSaved={() => { setOpen(false); setSaved(true); setTimeout(() => setSaved(false), 3000); }}
          onCancel={() => setOpen(false)}
        />
      )}
      {saved && <div className="mt-3 text-xs font-mono text-accent">✓ Logged. Full log → Error Log tab.</div>}
    </div>
  );
}

function QuickErrorForm({ currentDate, weekLabel, onSaved, onCancel }: any) {
  const [form, setForm] = useState({
    section: 'Quant' as 'Quant'|'Verbal',
    question_type: 'Arithmetic',
    source: 'Manhattan 5lb',
    source_ref: '',
    topic: '',
    what_i_did_wrong: '',
    fix_lesson: '',
  });

  async function save() {
    if (!form.what_i_did_wrong || !form.fix_lesson) return;
    await supabase.from('error_log').insert({
      ...form,
      question_date: currentDate,
      week_label: weekLabel ?? null,
    });
    onSaved();
  }

  const qTypes = form.section === 'Quant'
    ? ['Arithmetic','Algebra','Geometry','Word Problem','Data Analysis','Quantitative Comparison']
    : ['Text Completion','Sentence Equivalence','Reading Comprehension','Critical Reasoning'];

  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <select value={form.section} onChange={e => setForm({...form, section: e.target.value as any, question_type: e.target.value === 'Quant' ? 'Arithmetic' : 'Text Completion'})} className="border border-ink/20 px-2 py-1.5 bg-paper">
          <option>Quant</option><option>Verbal</option>
        </select>
        <select value={form.question_type} onChange={e => setForm({...form, question_type: e.target.value})} className="border border-ink/20 px-2 py-1.5 bg-paper">
          {qTypes.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <input value={form.source} onChange={e => setForm({...form, source: e.target.value})} placeholder="Source (e.g. Manhattan 5lb)" className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
      <input value={form.source_ref} onChange={e => setForm({...form, source_ref: e.target.value})} placeholder="Ref (e.g. Ch.3 Q47)" className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
      <input value={form.topic} onChange={e => setForm({...form, topic: e.target.value})} placeholder="Topic (free-text)" className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
      <textarea value={form.what_i_did_wrong} onChange={e => setForm({...form, what_i_did_wrong: e.target.value})} placeholder="What I did wrong (1 sentence)" rows={2} className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
      <textarea value={form.fix_lesson} onChange={e => setForm({...form, fix_lesson: e.target.value})} placeholder="Fix / lesson" rows={2} className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
      <div className="flex gap-2 pt-1">
        <button onClick={save} className="flex-1 bg-ink text-paper px-3 py-2 text-xs uppercase tracking-widest">Save</button>
        <button onClick={onCancel} className="px-3 py-2 text-xs uppercase tracking-widest border border-ink/20">Cancel</button>
      </div>
    </div>
  );
}
