'use client';

import { useEffect, useState } from 'react';
import { supabase, type ErrorEntry } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';

const SOURCES = [
  'Official Guide — Quant',
  'Official Guide — Verbal',
  'Manhattan 5lb',
  'Prepswift',
  'Practice Test 1',
  'Practice Test 2',
  'Practice Test 3',
  'Practice Test 4',
  'Practice Test 5',
  'Practice Test 6',
  'Practice Test 7',
  'Practice Test 8',
  'Other',
];

const ERROR_TYPES = [
  'Knowledge Gap',
  'Process Error',
  'Miscalculation',
  'Misread',
  'Careless Mistake',
  'Timing / Strategy',
];

const QUANT_TYPES = ['Arithmetic','Algebra','Geometry','Word Problem','Data Analysis','Quantitative Comparison'];
const VERBAL_TYPES = ['Text Completion','Sentence Equivalence','Reading Comprehension','Critical Reasoning'];

const TIME_STATUS = ['Under time', 'On time', 'Over time'];

export default function ErrorLogPanel() {
  const [entries, setEntries] = useState<ErrorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ section?: string; source?: string; error_type?: string; repeatsOnly?: boolean }>({});
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    let q = supabase.from('error_log').select('*').order('logged_at', { ascending: false });
    if (filter.section) q = q.eq('section', filter.section);
    if (filter.source) q = q.eq('source', filter.source);
    if (filter.error_type) q = q.eq('error_type', filter.error_type);
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

  function exportCSV() {
    const cols = ['question_date','section','question_type','source','source_ref','topic','error_type','time_status','difficulty','what_i_did_wrong','fix_lesson','is_repeat_pattern','reattempted','reattempt_correct'];
    const esc = (v: unknown) => { const s = v == null ? '' : String(v); return `"${s.replace(/"/g, '""')}"` };
    const blob = new Blob([cols.join(',') + '\n' + entries.map(e => cols.map(c => esc((e as any)[c])).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `m7-error-log-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const repeatCount = entries.filter(e => e.is_repeat_pattern).length;

  // Count by error type for a quick breakdown
  const byType: Record<string, number> = {};
  for (const e of entries) {
    const t = (e as any).error_type ?? 'Unknown';
    byType[t] = (byType[t] ?? 0) + 1;
  }

  return (
    <div>
      <div className="flex items-end justify-between border-b border-ink/15 pb-4 mb-6 flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted font-mono">Why did I miss it?</div>
          <h2 className="font-display text-4xl font-extrabold mt-1">Error Log</h2>
          <div className="text-sm text-muted mt-2">
            <span className="tag-num font-medium text-ink">{entries.length}</span> total ·
            <span className="tag-num font-medium text-accent ml-2">{repeatCount}</span> repeat patterns
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV} className="border border-ink/20 px-4 py-2 text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors">
            ↓ Export CSV
          </button>
          <button onClick={() => setShowForm(s => !s)} className="bg-ink text-paper px-4 py-2 text-xs uppercase tracking-widest">
            {showForm ? 'Close' : '+ Log a mistake'}
          </button>
        </div>
      </div>

      {showForm && <FullErrorForm onSaved={() => { setShowForm(false); load(); }} />}

      {/* Error type breakdown */}
      {entries.length > 0 && (
        <div className="mb-6 grid grid-cols-3 md:grid-cols-6 gap-2">
          {ERROR_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setFilter(f => ({ ...f, error_type: f.error_type === t ? undefined : t }))}
              className={`border px-2 py-2 text-[10px] uppercase tracking-widest font-mono text-center transition-colors ${
                filter.error_type === t ? 'bg-ink text-paper border-ink' : 'border-ink/15 hover:border-ink/40'
              }`}
            >
              <div className="text-2xl font-bold font-display text-inherit">{byType[t] ?? 0}</div>
              <div className="mt-0.5 leading-tight">{t}</div>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6 text-xs font-mono">
        <FilterChip active={!filter.section} onClick={() => setFilter({...filter, section: undefined})}>All sections</FilterChip>
        <FilterChip active={filter.section === 'Quant'} onClick={() => setFilter({...filter, section: 'Quant'})}>Quant</FilterChip>
        <FilterChip active={filter.section === 'Verbal'} onClick={() => setFilter({...filter, section: 'Verbal'})}>Verbal</FilterChip>
        <FilterChip active={!!filter.repeatsOnly} onClick={() => setFilter({...filter, repeatsOnly: !filter.repeatsOnly})}>
          {filter.repeatsOnly ? '☒' : '☐'} Repeats only
        </FilterChip>
        <select
          value={filter.source ?? ''}
          onChange={e => setFilter({...filter, source: e.target.value || undefined})}
          className="border border-ink/20 px-3 py-1 bg-paper uppercase tracking-widest text-[10px]"
        >
          <option value="">All sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
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
                    <span className="text-ink font-medium">{e.section}</span>
                    <span>·</span>
                    <span>{e.question_type}</span>
                    <span>·</span>
                    <span>{e.source}{e.source_ref ? ` — ${e.source_ref}` : ''}</span>
                    {(e as any).error_type && (
                      <span className="border border-ink/30 px-1.5 py-0.5">{(e as any).error_type}</span>
                    )}
                    {(e as any).time_status && (
                      <span className={`px-1.5 py-0.5 ${(e as any).time_status === 'Over time' ? 'bg-accent/20 text-accent' : 'bg-ink/10'}`}>
                        {(e as any).time_status}
                      </span>
                    )}
                    {e.is_repeat_pattern && (
                      <span className="bg-accent text-paper px-1.5 py-0.5">Repeat pattern</span>
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
                      <div>{e.fix_lesson}</div>
                    </div>
                  </div>
                </div>
                <button onClick={() => del(e.id)} className="text-xs text-muted hover:text-accent flex-shrink-0">×</button>
              </div>

              <div className="mt-4 pt-3 border-t border-ink/10 flex items-center gap-3 text-xs">
                <span className="text-muted uppercase tracking-widest font-mono">Re-attempt:</span>
                {!e.reattempted ? (
                  <>
                    <button onClick={() => reattempt(e, true)} className="border border-ink/30 px-3 py-1 hover:bg-ink hover:text-paper transition-colors">✓ Got it</button>
                    <button onClick={() => reattempt(e, false)} className="border border-accent text-accent px-3 py-1 hover:bg-accent hover:text-paper transition-colors">✗ Missed again</button>
                  </>
                ) : (
                  <span className={`font-mono ${e.reattempt_correct ? 'text-ink' : 'text-accent'}`}>
                    {e.reattempt_correct ? '✓ Reattempt passed' : '✗ Reattempt failed — critical pattern'}
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
    <button onClick={onClick} className={`px-3 py-1 uppercase tracking-widest border text-[10px] ${active ? 'bg-ink text-paper border-ink' : 'border-ink/20'}`}>
      {children}
    </button>
  );
}

function FullErrorForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    question_date: format(new Date(), 'yyyy-MM-dd'),
    section: 'Quant' as 'Quant' | 'Verbal',
    question_type: 'Arithmetic',
    source: 'Official Guide — Quant',
    source_ref: '',
    topic: '',
    difficulty: 'Medium',
    error_type: 'Knowledge Gap',
    time_status: 'On time',
    what_i_did_wrong: '',
    fix_lesson: '',
  });

  async function save() {
    if (!form.what_i_did_wrong || !form.fix_lesson) {
      alert('Fill in "what went wrong" and "fix / lesson" before saving.');
      return;
    }
    await supabase.from('error_log').insert({
      question_date: form.question_date,
      section: form.section,
      question_type: form.question_type,
      source: form.source,
      source_ref: form.source_ref || null,
      topic: form.topic || null,
      difficulty: form.difficulty,
      error_type: form.error_type,
      time_status: form.time_status,
      what_i_did_wrong: form.what_i_did_wrong,
      fix_lesson: form.fix_lesson,
      tags: [],
    });
    onSaved();
  }

  const qTypes = form.section === 'Quant' ? QUANT_TYPES : VERBAL_TYPES;

  return (
    <div className="border-2 border-ink p-6 mb-6 bg-paper">
      <h3 className="font-display text-2xl font-bold mb-5">Log a mistake</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Field label="Date">
          <input type="date" value={form.question_date}
            onChange={e => setForm({...form, question_date: e.target.value})}
            className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
        </Field>

        <Field label="Section">
          <select value={form.section}
            onChange={e => setForm({...form, section: e.target.value as any, question_type: e.target.value === 'Quant' ? 'Arithmetic' : 'Text Completion'})}
            className="w-full border border-ink/20 px-2 py-1.5 bg-paper">
            <option>Quant</option><option>Verbal</option>
          </select>
        </Field>

        <Field label="Question type">
          <select value={form.question_type}
            onChange={e => setForm({...form, question_type: e.target.value})}
            className="w-full border border-ink/20 px-2 py-1.5 bg-paper">
            {qTypes.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>

        <Field label="Difficulty">
          <select value={form.difficulty}
            onChange={e => setForm({...form, difficulty: e.target.value})}
            className="w-full border border-ink/20 px-2 py-1.5 bg-paper">
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
        </Field>

        <Field label="Source">
          <select value={form.source}
            onChange={e => setForm({...form, source: e.target.value})}
            className="w-full border border-ink/20 px-2 py-1.5 bg-paper">
            {SOURCES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Source ref">
          <input value={form.source_ref}
            onChange={e => setForm({...form, source_ref: e.target.value})}
            placeholder="Ch.3 Q47 / p.212"
            className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
        </Field>

        <Field label="Why I missed it">
          <select value={form.error_type}
            onChange={e => setForm({...form, error_type: e.target.value})}
            className="w-full border border-ink/20 px-2 py-1.5 bg-paper">
            {ERROR_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>

        <Field label="Time">
          <select value={form.time_status}
            onChange={e => setForm({...form, time_status: e.target.value})}
            className="w-full border border-ink/20 px-2 py-1.5 bg-paper">
            {TIME_STATUS.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Topic (free text)">
        <input value={form.topic}
          onChange={e => setForm({...form, topic: e.target.value})}
          placeholder="e.g. triangle inequality, pivot words, exponent rules…"
          className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
      </Field>

      <div className="grid md:grid-cols-2 gap-3 mt-1">
        <Field label="What I did wrong (1 sentence)">
          <textarea value={form.what_i_did_wrong}
            onChange={e => setForm({...form, what_i_did_wrong: e.target.value})}
            rows={3}
            className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
        </Field>
        <Field label="Fix / lesson">
          <textarea value={form.fix_lesson}
            onChange={e => setForm({...form, fix_lesson: e.target.value})}
            rows={3}
            className="w-full border border-ink/20 px-2 py-1.5 bg-paper"/>
        </Field>
      </div>

      <button onClick={save} className="bg-ink text-paper px-6 py-2 text-sm uppercase tracking-widest mt-5">
        Save entry
      </button>
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
