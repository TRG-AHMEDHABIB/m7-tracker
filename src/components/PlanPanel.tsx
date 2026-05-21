'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const GPT_PROMPT_TEMPLATE = `You are helping me revise my GRE prep schedule. I'm taking the GRE on August 22, 2026.

I will paste the JSON of my current daily plan below. Each entry has:
- task_date (YYYY-MM-DD)
- week_label (W1..W13)
- day_label (e.g. "Work day", "Light Saturday", "Memorial Day")
- icon (emoji)
- task_text (the actual task)
- minutes (duration)
- task_type (SETUP|VIDEO|PRACTICE|MEMORIZE|VOCAB|REVIEW|TEST|REST)
- sort_order (order within the day)

CONSTRAINTS YOU MUST RESPECT:
1. Test date is 2026-08-22 — never schedule anything after.
2. The five phases (Foundation W1-5, Strategy W6-7, Practice W8-10, Execution W11-12, Test Week W13) must stay intact — don't move arithmetic into geometry weeks, etc.
3. Practice tests on Jul 15, Jul 25, Aug 1, Aug 8, Aug 15 are locked dates.
4. Fridays are rest days (0 min) EXCEPT W8 PTO week — leave them empty.
5. Saturdays are 30-min vocab-only EXCEPT test-Saturdays.
6. W8 (Jul 13-19) is the PTO intensive — keep all 5 weekdays packed.
7. Total study time must stay roughly the same (don't dilute the plan).

WHAT I WANT YOU TO DO:
[Describe your edit here. Examples:
 - "Add 2 extra hard quant practice sessions in W10 because I'm still weak on geometry"
 - "Shift everything one week later — I'm extending the test date by a week"
 - "Replace all Manhattan 5lb references in W3-W5 with ETS Official Guide" ]

OUTPUT FORMAT:
Return ONLY a valid JSON array of task objects with the same shape as input. No prose, no markdown fences, just the array. Do NOT include the "done" field — that gets preserved automatically on import.

Here is my current plan:

[PASTE JSON BELOW]
`;

export default function PlanPanel() {
  const [exportedJson, setExportedJson] = useState<string>('');
  const [importJson, setImportJson] = useState<string>('');
  const [importResult, setImportResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  async function exportPlan() {
    setLoading(true);
    const { data, error } = await supabase.rpc('export_tasks_as_json');
    setLoading(false);
    if (error) {
      setImportResult('Error: ' + error.message);
      return;
    }
    setExportedJson(JSON.stringify(data, null, 2));
  }

  async function importPlan() {
    setImportResult(null);
    if (!importJson.trim()) {
      setImportResult('Paste a JSON plan first.');
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(importJson);
    } catch (e: any) {
      setImportResult('Invalid JSON: ' + e.message);
      return;
    }
    if (!Array.isArray(parsed)) {
      setImportResult('JSON must be an array of task objects.');
      return;
    }
    if (!confirm(`This will REPLACE all ${parsed.length} tasks in your plan. Your done/checked-off state will be preserved where possible. Continue?`)) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('import_tasks_from_json', { plan: parsed, preserve_done: true });
    setLoading(false);
    if (error) {
      setImportResult('Error: ' + error.message);
    } else {
      setImportResult(`✓ Imported ${data} tasks. Switch to Today tab to see the new plan.`);
      setImportJson('');
    }
  }

  function copyExport() {
    navigator.clipboard.writeText(exportedJson);
    setImportResult('Copied to clipboard.');
    setTimeout(() => setImportResult(null), 2000);
  }

  function copyPromptWithJson() {
    const filled = GPT_PROMPT_TEMPLATE.replace('[PASTE JSON BELOW]', exportedJson || '(click "Export current plan" first)');
    navigator.clipboard.writeText(filled);
    setImportResult('Prompt + JSON copied. Paste into ChatGPT/Claude.');
    setTimeout(() => setImportResult(null), 3000);
  }

  function downloadJson() {
    const blob = new Blob([exportedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gre-plan-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="border-b border-ink/15 pb-4 mb-6">
        <div className="text-xs uppercase tracking-widest text-muted font-mono">Iterate with AI</div>
        <h2 className="font-display text-4xl font-extrabold mt-1">Plan I/O</h2>
        <p className="text-sm text-muted mt-3 max-w-2xl leading-relaxed">
          Export your current plan as JSON, hand it to GPT/Claude with a prompt describing your edit, paste the result back. Your done-state is preserved on re-import where dates and sort-orders match.
        </p>
      </div>

      {/* STEP 1 — Export */}
      <section className="mb-10">
        <Step n="01" title="Export current plan" />
        <div className="border border-ink/20 p-5 space-y-3">
          <div className="flex gap-2">
            <button onClick={exportPlan} disabled={loading} className="bg-ink text-paper px-4 py-2 text-sm uppercase tracking-widest disabled:opacity-30">
              {loading ? 'Loading…' : 'Export current plan'}
            </button>
            {exportedJson && (
              <>
                <button onClick={copyExport} className="border border-ink/20 px-4 py-2 text-sm uppercase tracking-widest">
                  Copy JSON
                </button>
                <button onClick={downloadJson} className="border border-ink/20 px-4 py-2 text-sm uppercase tracking-widest">
                  ↓ Download .json
                </button>
                <button onClick={copyPromptWithJson} className="border-2 border-accent text-accent px-4 py-2 text-sm uppercase tracking-widest hover:bg-accent hover:text-paper transition-colors">
                  Copy prompt + JSON for GPT
                </button>
              </>
            )}
          </div>

          {exportedJson && (
            <details className="mt-3">
              <summary className="text-xs uppercase tracking-widest text-muted font-mono cursor-pointer hover:text-ink">
                Preview ({(exportedJson.length / 1024).toFixed(1)}kb · {(JSON.parse(exportedJson) as any[]).length} tasks)
              </summary>
              <pre className="mt-3 text-xs font-mono bg-ink/[0.03] border border-ink/10 p-3 max-h-64 overflow-auto whitespace-pre-wrap">
                {exportedJson.slice(0, 2000)}
                {exportedJson.length > 2000 && '\n…(truncated; click Copy or Download for full)'}
              </pre>
            </details>
          )}
        </div>
      </section>

      {/* STEP 2 — Prompt template */}
      <section className="mb-10">
        <Step n="02" title="Prompt template for GPT/Claude" />
        <div className="border border-ink/20 p-5">
          <button onClick={() => setShowPrompt(s => !s)} className="text-sm underline text-muted hover:text-ink">
            {showPrompt ? 'Hide' : 'Show'} the template
          </button>
          {showPrompt && (
            <pre className="mt-3 text-xs font-mono bg-ink/[0.03] border border-ink/10 p-4 max-h-96 overflow-auto whitespace-pre-wrap">
              {GPT_PROMPT_TEMPLATE}
            </pre>
          )}
          <p className="text-xs text-muted mt-3 leading-relaxed">
            The "Copy prompt + JSON for GPT" button above bundles this template with your exported plan. Paste into any chat, write what you want changed in the bracketed section, and ask for the revised JSON.
          </p>
        </div>
      </section>

      {/* STEP 3 — Import */}
      <section>
        <Step n="03" title="Import revised plan" />
        <div className="border border-ink/20 p-5">
          <textarea
            value={importJson}
            onChange={e => setImportJson(e.target.value)}
            placeholder='Paste the JSON array from GPT/Claude here…\n\n[\n  { "task_date": "2026-05-25", "week_label": "W1", ... },\n  ...\n]'
            rows={10}
            className="w-full border border-ink/20 p-3 font-mono text-xs bg-paper"
          />
          <div className="flex items-center gap-3 mt-3">
            <button onClick={importPlan} disabled={loading || !importJson.trim()} className="bg-accent text-paper px-4 py-2 text-sm uppercase tracking-widest disabled:opacity-30">
              {loading ? 'Importing…' : 'Replace plan with this JSON'}
            </button>
            <span className="text-xs text-muted">⚠ This overwrites all 372 tasks. Done-state is preserved where dates match.</span>
          </div>
          {importResult && (
            <div className={`mt-3 text-xs font-mono ${importResult.startsWith('✓') ? 'text-ink' : 'text-accent'}`}>
              {importResult}
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <Step n="04" title="Quick edits (no AI needed)" />
        <div className="border border-ink/20 p-5 text-sm leading-relaxed space-y-2">
          <p>For small tweaks, you don't need to round-trip through GPT. Some options:</p>
          <ul className="list-disc list-inside text-muted space-y-1 pl-2">
            <li>Click any unchecked task on the <span className="font-medium text-ink">Today</span> tab → check it off, or edit actual minutes after completion.</li>
            <li>Use the <span className="font-medium text-ink">Cap at 30 / 60 min</span> button on Today for a big-work-day flow.</li>
            <li>Use <span className="font-medium text-ink">Redistribute undone tasks</span> after a missed day.</li>
            <li>Edit individual tasks directly in Supabase (Table Editor → tasks) if you need to surgically swap one task for another.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function Step({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-4">
      <span className="tag-num text-accent text-2xl font-bold">{n}</span>
      <h3 className="font-display text-2xl font-bold">{title}</h3>
    </div>
  );
}
