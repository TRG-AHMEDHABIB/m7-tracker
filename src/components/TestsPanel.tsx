'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface PracticeTest {
  id: string;
  test_label: string;
  scheduled_date_label: string | null;
  taken_date: string | null;
  source: string | null;
  verbal_score: number | null;
  quant_score: number | null;
  total_score: number | null;
  top_weaknesses: string | null;
  notes: string | null;
}

const TARGET = 328;

export default function TestsPanel() {
  const [tests, setTests] = useState<PracticeTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PracticeTest>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('practice_tests').select('*').order('test_label');
    if (data) setTests(data as PracticeTest[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEdit(t: PracticeTest) {
    setEditing(t.id);
    setDraft({
      taken_date: t.taken_date,
      source: t.source ?? '',
      verbal_score: t.verbal_score,
      quant_score: t.quant_score,
      top_weaknesses: t.top_weaknesses ?? '',
      notes: t.notes ?? '',
    });
  }

  async function save(id: string) {
    setSaving(true);
    const payload = {
      taken_date: draft.taken_date || null,
      source: draft.source || null,
      verbal_score: draft.verbal_score != null ? Number(draft.verbal_score) : null,
      quant_score: draft.quant_score != null ? Number(draft.quant_score) : null,
      top_weaknesses: draft.top_weaknesses || null,
      notes: draft.notes || null,
    };
    await supabase.from('practice_tests').update(payload).eq('id', id);
    setSaving(false);
    setEditing(null);
    setDraft({});
    load();
  }

  const taken = tests.filter(t => t.total_score && t.total_score > 0);
  const latest = taken.length ? taken[taken.length - 1] : null;
  const baseline = tests.find(t => t.test_label.toLowerCase().includes('baseline'));
  const gainFromBaseline = latest && baseline && baseline.total_score && latest.total_score
    ? latest.total_score - baseline.total_score : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
      <div>
        <div className="mb-6 flex items-baseline justify-between border-b border-ink/15 pb-4">
          <h2 className="font-display text-4xl font-extrabold">Practice Tests</h2>
          <div className="text-right">
            <div className="tag-num text-5xl font-bold">{latest?.total_score ?? '—'}</div>
            <div className="text-xs uppercase tracking-widest text-muted font-mono">
              latest · target {TARGET} · gain +{gainFromBaseline}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-muted">Loading…</div>
        ) : (
          <ul className="space-y-3">
            {tests.map(t => {
              const isEditing = editing === t.id;
              const vsTarget = t.total_score ? t.total_score - TARGET : null;
              return (
                <li key={t.id} className="border border-ink/20 p-4">
                  <div className="flex items-baseline justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-display font-bold text-lg">{t.test_label}</div>
                      <div className="text-xs font-mono text-muted">
                        {t.scheduled_date_label ?? '—'}{t.taken_date ? ` · taken ${t.taken_date}` : ''}
                      </div>
                    </div>
                    {t.total_score ? (
                      <div className="flex items-baseline gap-3">
                        <span className="text-xs font-mono text-muted">V {t.verbal_score} · Q {t.quant_score}</span>
                        <span className="tag-num text-2xl font-bold">{t.total_score}</span>
                        <span className={`text-xs font-mono ${vsTarget && vsTarget >= 0 ? 'text-accent' : 'text-muted'}`}>
                          {vsTarget != null && vsTarget >= 0 ? '+' : ''}{vsTarget}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(t)}
                        className="text-xs uppercase tracking-widest border border-ink/20 px-3 py-1.5 hover:bg-ink hover:text-paper transition-colors"
                      >+ Log score</button>
                    )}
                  </div>

                  {(t.top_weaknesses || t.notes) && !isEditing && (
                    <div className="mt-3 text-sm text-muted">
                      {t.top_weaknesses && <div><span className="font-mono text-xs uppercase">Weak: </span>{t.top_weaknesses}</div>}
                      {t.notes && <div className="mt-1"><span className="font-mono text-xs uppercase">Notes: </span>{t.notes}</div>}
                    </div>
                  )}

                  {t.total_score && !isEditing && (
                    <button
                      onClick={() => startEdit(t)}
                      className="mt-3 text-[10px] uppercase tracking-widest text-muted hover:text-ink"
                    >edit</button>
                  )}

                  {isEditing && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <input
                        type="date"
                        value={draft.taken_date ?? ''}
                        onChange={e => setDraft({...draft, taken_date: e.target.value})}
                        className="border border-ink/20 px-2 py-1.5 bg-paper col-span-2"
                      />
                      <input
                        placeholder="Source (e.g. ETS PowerPrep 1)"
                        value={draft.source ?? ''}
                        onChange={e => setDraft({...draft, source: e.target.value})}
                        className="border border-ink/20 px-2 py-1.5 bg-paper col-span-2"
                      />
                      <input
                        type="number" min={130} max={170}
                        placeholder="Verbal (130-170)"
                        value={draft.verbal_score ?? ''}
                        onChange={e => setDraft({...draft, verbal_score: e.target.value === '' ? null : Number(e.target.value)})}
                        className="border border-ink/20 px-2 py-1.5 bg-paper"
                      />
                      <input
                        type="number" min={130} max={170}
                        placeholder="Quant (130-170)"
                        value={draft.quant_score ?? ''}
                        onChange={e => setDraft({...draft, quant_score: e.target.value === '' ? null : Number(e.target.value)})}
                        className="border border-ink/20 px-2 py-1.5 bg-paper"
                      />
                      <textarea
                        placeholder="Top 3 weaknesses"
                        rows={2}
                        value={draft.top_weaknesses ?? ''}
                        onChange={e => setDraft({...draft, top_weaknesses: e.target.value})}
                        className="border border-ink/20 px-2 py-1.5 bg-paper col-span-2"
                      />
                      <textarea
                        placeholder="Notes"
                        rows={2}
                        value={draft.notes ?? ''}
                        onChange={e => setDraft({...draft, notes: e.target.value})}
                        className="border border-ink/20 px-2 py-1.5 bg-paper col-span-2"
                      />
                      <div className="col-span-2 flex gap-2">
                        <button
                          onClick={() => save(t.id)}
                          disabled={saving}
                          className="flex-1 bg-ink text-paper px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-30"
                        >{saving ? 'Saving…' : 'Save'}</button>
                        <button
                          onClick={() => { setEditing(null); setDraft({}); }}
                          className="px-3 py-2 text-xs uppercase tracking-widest border border-ink/20"
                        >Cancel</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <aside className="border border-ink/20 p-5 h-fit">
        <h3 className="font-display text-lg font-bold mb-3">Trajectory</h3>
        <div className="space-y-2 text-sm font-mono">
          {taken.length === 0 ? (
            <div className="text-muted">No tests logged yet.</div>
          ) : taken.map(t => {
            const pct = ((t.total_score! - 260) / (340 - 260)) * 100;
            return (
              <div key={t.id}>
                <div className="flex justify-between text-xs">
                  <span>{t.test_label}</span>
                  <span className="font-bold">{t.total_score}</span>
                </div>
                <div className="h-2 bg-ink/10 mt-0.5">
                  <div className="h-full bg-ink" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                </div>
              </div>
            );
          })}
          <div className="border-t border-ink/15 pt-2 mt-3 flex justify-between text-xs text-accent">
            <span>Target</span><span className="font-bold">{TARGET}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
