'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface WeeklyGoal {
  week_label: string;
  dates_label: string;
  focus: string | null;
  phase: string | null;
  hours_target: number | null;
  quant_q_target: number | null;
  verbal_q_target: number | null;
  vocab_target: number | null;
  notes: string | null;
  reflection: string | null;
  reflection_at: string | null;
}

interface WeeklyProgress {
  week_label: string;
  hours_done: number | null;
  tasks_total?: number;
  tasks_done?: number;
}

export default function WeeklyGoalsPanel() {
  const [goals, setGoals] = useState<WeeklyGoal[]>([]);
  const [progress, setProgress] = useState<Record<string, WeeklyProgress>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedFor, setSavedFor] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [g, p, t] = await Promise.all([
      supabase.from('weekly_goals').select('*').order('week_label'),
      supabase.from('v_weekly_progress').select('week_label, hours_done'),
      supabase.from('tasks').select('week_label, done'),
    ]);
    if (g.data) setGoals(
      (g.data as WeeklyGoal[]).sort((a, b) =>
        parseInt(a.week_label.replace('W', '')) - parseInt(b.week_label.replace('W', ''))
      )
    );
    const map: Record<string, WeeklyProgress> = {};
    if (p.data) for (const r of p.data as WeeklyProgress[]) map[r.week_label] = { ...r };
    if (t.data) {
      for (const row of t.data as Array<{ week_label: string; done: boolean }>) {
        const m = map[row.week_label] ??= { week_label: row.week_label, hours_done: 0 };
        m.tasks_total = (m.tasks_total ?? 0) + 1;
        if (row.done) m.tasks_done = (m.tasks_done ?? 0) + 1;
      }
    }
    setProgress(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveReflection(week: string) {
    const text = draft[week] ?? '';
    setSaving(week);
    await supabase
      .from('weekly_goals')
      .update({ reflection: text || null, reflection_at: text ? new Date().toISOString() : null })
      .eq('week_label', week);
    setSaving(null);
    setSavedFor(week);
    setTimeout(() => setSavedFor(null), 2500);
    load();
  }

  const totals = useMemo(() => {
    let hoursTgt = 0, hoursDone = 0;
    for (const g of goals) {
      hoursTgt += g.hours_target ?? 0;
      hoursDone += progress[g.week_label]?.hours_done ?? 0;
    }
    return { hoursTgt, hoursDone };
  }, [goals, progress]);

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between border-b border-ink/15 pb-4 flex-wrap gap-4">
        <h2 className="font-display text-4xl font-extrabold">Weekly Goals</h2>
        <div className="flex items-baseline gap-6 text-xs font-mono uppercase tracking-widest text-muted">
          <span><span className="tag-num text-ink font-bold text-2xl">{totals.hoursDone.toFixed(1)}</span>/{totals.hoursTgt} hrs</span>
          <span>{goals.length} weeks</span>
        </div>
      </div>

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : (
        <ul className="space-y-3">
          {goals.map(g => {
            const prog = progress[g.week_label];
            const hoursDone = prog?.hours_done ?? 0;
            const hoursTgt = g.hours_target ?? 0;
            const delta = hoursDone - hoursTgt;
            const pct = hoursTgt > 0 ? Math.min(100, (hoursDone / hoursTgt) * 100) : 0;
            const text = draft[g.week_label] ?? g.reflection ?? '';
            return (
              <li key={g.week_label} className="border border-ink/20 p-4">
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-display font-bold text-lg">{g.week_label} · {g.focus}</div>
                    <div className="text-xs font-mono text-muted">{g.dates_label} · {g.phase}</div>
                  </div>
                  <div className="flex items-baseline gap-4 text-xs font-mono">
                    <span className="text-muted">Hrs</span>
                    <span className="tag-num text-xl font-bold">{hoursDone.toFixed(1)}</span>
                    <span className="text-muted">/ {hoursTgt}</span>
                    <span className={delta >= 0 ? 'text-accent' : 'text-muted'}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}h
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-1.5 bg-ink/10">
                  <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                </div>

                <div className="mt-3 grid grid-cols-4 gap-3 text-xs font-mono">
                  <Stat label="Tasks done" value={`${prog?.tasks_done ?? 0}/${prog?.tasks_total ?? 0}`} />
                  <Stat label="Quant Q tgt" value={g.quant_q_target ?? '—'} />
                  <Stat label="Verbal Q tgt" value={g.verbal_q_target ?? '—'} />
                  <Stat label="Vocab tgt" value={g.vocab_target ?? '—'} />
                </div>

                <div className="mt-4 border-t border-ink/10 pt-3">
                  <label className="text-[10px] uppercase tracking-widest font-mono text-muted">Reflection</label>
                  <textarea
                    value={text}
                    onChange={e => setDraft({...draft, [g.week_label]: e.target.value})}
                    placeholder="What worked? What didn't? Adjust for next week."
                    rows={2}
                    className="mt-1 w-full border border-ink/15 px-2 py-1.5 bg-paper text-sm"
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => saveReflection(g.week_label)}
                      disabled={saving === g.week_label || text === (g.reflection ?? '')}
                      className="text-xs uppercase tracking-widest border border-ink/20 px-3 py-1.5 hover:bg-ink hover:text-paper transition-colors disabled:opacity-30"
                    >{saving === g.week_label ? 'Saving…' : 'Save reflection'}</button>
                    {savedFor === g.week_label && <span className="text-xs font-mono text-accent">✓ saved</span>}
                    {g.reflection_at && !savedFor && (
                      <span className="text-[10px] font-mono text-muted">
                        last saved {new Date(g.reflection_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-ink/10 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-muted">{label}</div>
      <div className="font-bold mt-0.5">{value}</div>
    </div>
  );
}
