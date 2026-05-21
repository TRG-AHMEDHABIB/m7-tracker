'use client';

import { useRef, useState } from 'react';
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

function parseCSV(text: string): Record<string, string>[] {
  const lines: string[] = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === '\n' && !inQuotes) {
      lines.push(cur); cur = '';
    } else if (ch === '\r' && !inQuotes) {
      // skip
    } else { cur += ch; }
  }
  if (cur) lines.push(cur);
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const out: string[] = [];
    let f = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { f += '"'; i++; }
        else q = !q;
      } else if (ch === ',' && !q) { out.push(f); f = ''; }
      else f += ch;
    }
    out.push(f);
    return out;
  };

  const headers = parseRow(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
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
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleUpload(t: ExportTable, file: File) {
    setUploadMsg(null);
    setError(null);
    if (!confirm(`This will REPLACE all rows in "${t.label}" with the contents of ${file.name}. Continue?`)) return;
    setBusy(`upload-${t.id}`);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) { setError('CSV is empty'); setBusy(null); return; }

      // Coerce blank strings → null, parse booleans/numbers loosely
      const clean = rows.map(r => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          if (v === '' || v == null) { out[k] = null; continue; }
          if (v === 'true') out[k] = true;
          else if (v === 'false') out[k] = false;
          else out[k] = v;
        }
        return out;
      });

      const { error: delErr } = await supabase.from(t.table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delErr && !delErr.message.includes('id')) {
        // fallback for tables without id (weekly_goals uses week_label PK)
        const { error: del2 } = await supabase.from(t.table).delete().neq('week_label', '');
        if (del2) { setError(`Delete failed: ${del2.message}`); setBusy(null); return; }
      }

      const { error: insErr } = await supabase.from(t.table).insert(clean);
      if (insErr) { setError(`Insert failed: ${insErr.message}`); setBusy(null); return; }

      setUploadMsg(`✓ Replaced ${t.label} with ${clean.length} rows from ${file.name}`);
      setTimeout(() => setUploadMsg(null), 5000);
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(null);
  }

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
    download(`m7-${t.table}-${date}.csv`, toCSV(data as Record<string, unknown>[]));
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
      download(`m7-${t.table}-${date}.csv`, toCSV(data as Record<string, unknown>[]));
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
            <div className="flex items-center gap-2 flex-shrink-0">
              {done === t.id && <span className="text-xs font-mono text-accent">✓ downloaded</span>}
              <button
                onClick={() => exportTable(t)}
                disabled={busy !== null}
                className="border border-ink/20 px-3 py-2 text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors disabled:opacity-30"
              >
                {busy === t.id ? 'Downloading…' : '↓ Download'}
              </button>
              <input
                ref={el => { fileInputs.current[t.id] = el; }}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(t, file);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => fileInputs.current[t.id]?.click()}
                disabled={busy !== null}
                className="border border-ink/20 px-3 py-2 text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors disabled:opacity-30"
              >
                {busy === `upload-${t.id}` ? 'Uploading…' : '↑ Upload'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {uploadMsg && (
        <div className="mt-4 text-xs font-mono text-accent border border-accent/30 px-4 py-2">
          {uploadMsg}
        </div>
      )}
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
