'use client';

import { useEffect, useState } from 'react';
import { supabase, type ErrorEntry } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';

export default function ErrorLogPanel() {
  const [entries, setEntries] = useState<ErrorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ section?: string; source?: string; repeatsOnly?: boolean }>({});
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    let q = supabase.from('error_log').select('*').order('logged_at', { ascending: false });
    if (filter.section) q = q.eq('section', filter.section);
    if (filter.source) q = q.eq('source', filter.source);
    if (filter.repeatsOnly) q = q.eq('is_repeat_pattern', true);
    const { data } = await q;
    setEntries((data ?? []) as ErrorEntry[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function reattempt(e: ErrorEntry, correct: boolean) {
    await supabase.from('error_log').update({
      reattempted: true,
      reattempted_at: new Date().toISOString(),
      reattempt_correct: correct,
    }).eq('id', e.id);
    load();
  }

  async function del(id: string) {
    if (!confirm('Delete this entry?')) return;
    await supabase.from('error_log').delete().eq('id', id);
    load();
  }

  // CSV export — paste into Google Sheets, or import as a Sheet
  function exportCSV() {
    const cols = ['question_date','section','question_type','source','source_ref','topic','what_i_did_wrong','fix_lesson','is_repeat_pattern','reattempted','reattempt_correct','tags'];
    const header = cols.join(',');
    const rows = entries.map(e =>
      cols.map(c => {
        const v = (e as any)[c];
        if (v === null || v === undefined) return '';
        const s = Array.isArray(v) ? v.join('|') : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      }).join(',')
    );
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sources = Array.from(new Set(entries.map(e => e.source))).sort();
  const repeatCount = entries.filter(e => e.is_repeat_pattern).length;

  return (
    <div>
      <div className="flex items-end justify-between border-b border-ink/15 pb-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted font-mono">Why did I miss it?</div>
          <h2 className="font-display text-4xl font-extrabold mt-1">Error Log</h2>
          <div className="text-sm text-muted mt-2">
            <span className="tag-num font-medium text-ink">{entries.length}</span> total ·
            <span className="tag-num font-medium text-accent ml-2">{repeatCount}</span> repeat patterns
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="border border-ink/20 px-4 py-2 text-xs uppercase tracking-widest">
            ↓ Export CSV
          </button>
          <button onClick={() => setShowForm(s => !s)} className="bg-ink text-paper px-4 py-2 text-xs uppercase tracking-widest">
            {showForm ? 'Close' : '+ New Entry'}
          </button>
        </div>
      </div>

      {showForm && <FullErrorForm onSaved={() => { setShowForm(false); load(); }} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6 text-xs font-mono">
        <FilterChip active={!filter.section} onClick={() => setFilter({...filter, section: undefined})}>ALL SECTIONS</FilterChip>
        <FilterChip active={filter.section === 'Quant'} onClick={() => setFilter({...filter, section: 'Quant'})}>QUANT</FilterChip>
        <FilterChip active={filter.section === 'Verbal'} onClick={() => setFilter({...filter, section: 'Verbal'})}>VERBAL</FilterChip>
        <FilterChip active={!!filter.repeatsOnly} onClick={() => setFilter({...filter, repeatsOnly: !filter.repeatsOnly})}>
          {filter.repeatsOnly ? '☒' : '☐'} REPEATS ONLY
        </FilterChip>
        {sources.length > 0 && (
          <select
            value={filter.source ?? ''}
            onChange={e => setFilter({...filter, source: e.target.value || undefined})}
            className="border border-ink/20 px-3 py-1 bg-paper uppercase tracking-widest"
          >
            <option value="">ALL SOURCES</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="border-2 border-dashed border-ink/15 p-12 text-center text-muted">
          No entries yet. Log every miss — patterns emerge by Week 3.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(e => (
            <article key={e.id} className={`border ${e.is_repeat_pattern ? 'border-accent border-l-4' : 'border-ink/20'} p-5`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs font-mono uppercase tracking-widest text-muted mb-2">
                    <span>{format(parseISO(e.question_date), 'MMM d')}</span>
                    <span>·</span>
                    <span className="text-ink">{e.section}</span>
                    <span>·</span>
                    <span className="text-ink">{e.question_type}</span>
                    <span>·</span>
                    <span>{e.source}{e.source_ref ? ` — ${e.source_ref}` : ''}</span>
                    {e.is_repeat_pattern && (
                      <span className="bg-accent text-paper px-1.5 py-0.5">REPEAT PATTERN</span>
                    )}
                  </div>
                  {e.topic && <div className="text-sm font-medium mb-2">Topic: <span className="font-normal">{e.topic}</span></div>}
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted font-mono mb-1">What went wrong</div>
                      <div>{e.what_i_did_wrong}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted font-mono mb-1">Fix / lesson</div>
                      <div className="text-ink">{e.fix_lesson}</div>
                    </div>
                  </div>
                </div>
                <button onClick={() => del(e.id)} className="text-xs text-muted hover:text-accent">×</button>
              </div>

              <div className="mt-4 pt-3 border-t border-ink/10 flex items-center gap-3 text-xs">
                <span className="text-muted uppercase tracking-widest font-mono">Re-attempt:</span>
                {!e.reattempted ? (
                  <>
                    <button onClick={() => reattempt(e, true)} className="border border-ink/30 px-3 py-1 hover:bg-ink hover:text-paper">✓ Got it</button>
                    <button onClick={() => reattempt(e, false)} className="border border-accent text-accent px-3 py-1 hover:bg-accent hover:text-paper">✗ Missed again</button>
                  </>
                ) : (
                  <span className={`font-mono ${e.reattempt_correct ? 'text-ink' : 'text-accent'}`}>
                    {e.reattempt_correct ? '✓ Reattempt PASSED' : '✗ Reattempt FAILED — critical pattern'}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 uppercase tracking-widest border ${active ? 'bg-ink text-paper border-ink' : 'border-ink/20'}`}
    >
      {children}
    </button>
  );
}

function FullErrorForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    question_date: format(new Date(), 'yyyy-MM-dd'),
    section: 'Quant' as 'Quant'|'Verbal',
    question_type: 'Arithmetic',
    source: 'Manhattan 5lb',
    source_ref: '',
    topic: '',
    difficulty: 'Medium',
    what_i_did_wrong: '',
    fix_lesson: '',
    time_spent_seconds: '',
    tags: '',
  });

  async function save() {
    if (!form.what_i_did_wrong || !form.fix_lesson) {
      alert('Need "what went wrong" + "fix" to log.');
      return;
    }
    const payload: any = { ...form };
    payload.time_spent_seconds = form.time_spent_seconds ? parseInt(form.time_spent_seconds) : null;
    payload.tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    await supabase.from('error_log').insert(payload);
    onSaved();
  }

  const qTypes = form.section === 'Quant'
    ? ['Arithmetic','Algebra','Geometry','Word Problem','Data Analysis','Quantitative Comparison']
    : ['Text Completion','Sentence Equivalence','Reading Comprehension','Critical Reasoning'];

  return (
    <div className="border-2 border-ink p-6 mb-6 bg-paper">
      <h3 className="font-display text-2xl font-bold mb-4">New error log entry</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Field label="Date">
          <input type="date" value={form.question_date} onChange={e => setForm({...form, question_date: e.target.value})} className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
        </Field>
        <Field label="Section">
          <select value={form.section} onChange={e => setForm({...form, section: e.target.value as any, question_type: e.target.value === 'Quant' ? 'Arithmetic' : 'Text Completion'})} className="w-full border border-ink/20 px-2 py-1.5 bg-paper">
            <option>Quant</option><option>Verbal</option>
          </select>
        </Field>
        <Field label="Question Type">
          <select value={form.question_type} onChange={e => setForm({...form, question_type: e.target.value})} className="w-full border border-ink/20 px-2 py-1.5 bg-paper">
            {qTypes.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Difficulty">
          <select value={form.difficulty} onChange={e => setForm({...form, difficulty: e.target.value})} className="w-full border border-ink/20 px-2 py-1.5 bg-paper">
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
        </Field>
        <Field label="Source">
          <input value={form.source} onChange={e => setForm({...form, source: e.target.value})} placeholder="Manhattan 5lb / Prepswift / Official Guide…" className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
        </Field>
        <Field label="Source ref">
          <input value={form.source_ref} onChange={e => setForm({...form, source_ref: e.target.value})} placeholder="Ch.3 Q47" className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
        </Field>
        <Field label="Topic">
          <input value={form.topic} onChange={e => setForm({...form, topic: e.target.value})} placeholder="triangle inequality, pivot words…" className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
        </Field>
        <Field label="Time (sec)">
          <input type="number" value={form.time_spent_seconds} onChange={e => setForm({...form, time_spent_seconds: e.target.value})} placeholder="180" className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
        </Field>
        <Field label="Tags (comma)">
          <input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="careless, timing, trap" className="w-full border border-ink/20 px-2 py-1.5 bg-paper col-span-2"/>
        </Field>
      </div>
      <Field label="What I did wrong (1 sentence)">
        <textarea value={form.what_i_did_wrong} onChange={e => setForm({...form, what_i_did_wrong: e.target.value})} rows={2} className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
      </Field>
      <Field label="Fix / lesson">
        <textarea value={form.fix_lesson} onChange={e => setForm({...form, fix_lesson: e.target.value})} rows={2} className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
      </Field>
      <button onClick={save} className="bg-ink text-paper px-6 py-2 text-sm uppercase tracking-widest mt-4">Save entry</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-xs uppercase tracking-widest text-muted font-mono mb-1">{label}</div>
      {children}
    </div>
  );
}
