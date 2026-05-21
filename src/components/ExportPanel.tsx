'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ExportTable {
  id: string;
  label: string;
  description: string;
  table: string;
  order?: string;
}

const TABLES: ExportTable[] = [
  {
    id: 'tasks',
    label: 'Daily Plan',
    description: 'All 372 tasks — dates, done state, reschedule history, actual minutes.',
    table: 'tasks',
    order: 'task_date,sort_order',
  },
  {
    id: 'error_log',
    label: 'Error Log',
    description: 'Every mistake logged — section, topic, what went wrong, fix.',
    table: 'error_log',
    order: 'logged_at',
  },
  {
    id: 'practice_tests',
    label: 'Practice Tests',
    description: 'Test dates, verbal/quant scores, weaknesses, notes.',
    table: 'practice_tests',
    order: 'test_label',
  },
  {
    id: 'quant_topics',
    label: 'Quant Topics',
    description: '60 topics — studied / drilled / mastered state + notes.',
    table: 'quant_topics',
    order: 'sort_order',
  },
  {
    id: 'weekly_goals',
    label: 'Weekly Goals',
    description: 'Per-week targets, hours, reflections.',
    table: 'weekly_goals',
    order: 'week_label',
  },
];

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n');
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPanel() {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportTable(t: ExportTable) {
    setBusy(t.id);
    setError(null);
    let query = supabase.from(t.table).select('*');
    if (t.order) {
      for (const col of t.order.split(',')) query = query.order(col);
    }
    const { data, error: err } = await query;
    setBusy(null);
    if (err || !data) { setError(err?.message ?? 'Unknown error'); return; }
    const date = new Date().toISOString().slice(0, 10);
    download(`gre-${t.table}-${date}.csv`, toCSV(data as Record<string, unknown>[]));
    setDone(t.id);
    setTimeout(() => setDone(null), 2500);
  }

  async function exportAll() {
    setBusy('all');
    setError(null);
    for (const t of TABLES) {
      let query = supabase.from(t.table).select('*');
      if (t.order) {
        for (const col of t.order.split(',')) query = query.order(col);
      }
      const { data, error: err } = await query;
      if (err || !data) { setError(`${t.table}: ${err?.message}`); setBusy(null); return; }
      const date = new Date().toISOString().slice(0, 10);
      download(`gre-${t.table}-${date}.csv`, toCSV(data as Record<string, unknown>[]));
      // slight delay so browser doesn't block multiple downloads
      await new Promise(r => setTimeout(r, 300));
    }
    setBusy(null);
    setDone('all');
    setTimeout(() => setDone(null), 3000);
  }

  return (
    <div>
      <div className="border-b border-ink/15 pb-4 mb-8">
        <h2 className="font-display text-4xl font-extrabold">Export Data</h2>
        <p className="text-sm text-muted mt-2 max-w-xl">
          Download any table as a CSV file. Open in Excel, Google Sheets, or keep as a backup.
          Do this weekly — takes 10 seconds.
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={exportAll}
          disabled={busy !== null}
          className="bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest font-medium disabled:opacity-30 hover:opacity-80 transition-opacity"
        >
          {busy === 'all' ? 'Downloading…' : '↓ Download all tables'}
        </button>
        {done === 'all' && (
          <span className="ml-4 text-xs font-mono text-accent">✓ All 5 CSVs downloaded</span>
        )}
      </div>

      <ul className="space-y-3">
        {TABLES.map(t => (
          <li key={t.id} className="border border-ink/20 p-4 flex items-center justify-between gap-6">
            <div>
              <div className="font-medium">{t.label}</div>
              <div className="text-xs text-muted font-mono mt-0.5">{t.description}</div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {done === t.id && <span className="text-xs font-mono text-accent">✓ downloaded</span>}
              <button
                onClick={() => exportTable(t)}
                disabled={busy !== null}
                className="border border-ink/20 px-4 py-2 text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors disabled:opacity-30"
              >
                {busy === t.id ? 'Downloading…' : `↓ ${t.label}`}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {error && (
        <div className="mt-4 text-xs font-mono text-accent border border-accent/30 px-4 py-2">
          Error: {error}
        </div>
      )}

      <div className="mt-10 border border-ink/10 p-5 text-sm text-muted space-y-2">
        <div className="font-medium text-ink text-xs uppercase tracking-widest font-mono mb-3">Quick edits — no export needed</div>
        <p>• Missed a day? → <strong className="text-ink">Today</strong> tab → Redistribute button</p>
        <p>• Big work day tomorrow? → <strong className="text-ink">Today</strong> tab → Cap at 30/60 min</p>
        <p>• Need to swap a single task? → Supabase Dashboard → Table Editor → tasks</p>
        <p>• Scored a practice test? → <strong className="text-ink">Tests</strong> tab → Log score</p>
      </div>
    </div>
  );
}
