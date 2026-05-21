'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts';

const COLORS = {
  Quant: '#0a0a0b',
  Verbal: '#d64545',
  axis: '#6b6661',
};

export default function ProgressPanel() {
  const [bySource, setBySource] = useState<any[]>([]);
  const [byType, setByType] = useState<any[]>([]);
  const [byWeek, setByWeek] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [src, typ, wk, wprog, ptests] = await Promise.all([
        supabase.from('v_errors_by_source').select('*'),
        supabase.from('v_errors_by_type').select('*'),
        supabase.from('v_errors_by_week').select('*'),
        supabase.from('v_weekly_progress').select('*'),
        supabase.from('practice_tests').select('*').order('test_label'),
      ]);
      const weekNum = (label: string) => parseInt(String(label).replace(/\D/g, ''), 10) || 0;
      setBySource(src.data ?? []);
      setByType(typ.data ?? []);
      setByWeek((wk.data ?? []).sort((a: any, b: any) => weekNum(a.week_label) - weekNum(b.week_label)));
      setWeekly((wprog.data ?? []).sort((a: any, b: any) => weekNum(a.week_label) - weekNum(b.week_label)));
      setTests(ptests.data ?? []);
    })();
  }, []);

  // Aggregate "by type" for chart
  const typeChart = byType.map(r => ({
    name: r.question_type,
    Errors: r.total_errors,
    Repeats: r.repeat_errors,
    section: r.section,
  }));

  // Group "by source" by source
  const sourceChart = Array.from(
    bySource.reduce((m, r) => {
      const cur = m.get(r.source) || { name: r.source, Quant: 0, Verbal: 0 };
      cur[r.section] = r.error_count;
      m.set(r.source, cur);
      return m;
    }, new Map()).values()
  );

  // Trajectory: practice test scores over time
  const testTraj = tests
    .filter((t: any) => t.total_score && t.total_score > 0)
    .map((t: any) => ({ name: t.test_label, Total: t.total_score, V: t.verbal_score, Q: t.quant_score }));

  return (
    <div className="space-y-10">
      <div className="border-b border-ink/15 pb-4">
        <div className="text-xs uppercase tracking-widest text-muted font-mono">Pattern recognition</div>
        <h2 className="font-display text-4xl font-extrabold mt-1">Progress & Weak Spots</h2>
      </div>

      {/* Pivot: errors by question type */}
      <section>
        <Header n="01" title="Errors by question type" sub="Your weak-spot ranking. Drill the top 3." />
        {typeChart.length === 0 ? (
          <EmptyState msg="No errors logged yet — chart populates after first entry." />
        ) : (
          <div className="h-80 border border-ink/20 p-4 bg-paper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeChart} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" stroke={COLORS.axis} fontSize={11} />
                <YAxis type="category" dataKey="name" stroke={COLORS.axis} fontSize={11} width={170} />
                <Tooltip contentStyle={{ background: '#f5f1e8', border: '1px solid #0a0a0b' }} />
                <Bar dataKey="Errors" fill={COLORS.Quant}>
                  {typeChart.map((d, i) => (
                    <Cell key={i} fill={d.section === 'Verbal' ? COLORS.Verbal : COLORS.Quant} />
                  ))}
                </Bar>
                <Bar dataKey="Repeats" fill={COLORS.Verbal} fillOpacity={0.4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Pivot: errors by source */}
      <section>
        <Header n="02" title="Errors by source" sub="Which book/test is generating the most mistakes — and in which section." />
        {sourceChart.length === 0 ? (
          <EmptyState msg="No errors logged yet." />
        ) : (
          <div className="h-72 border border-ink/20 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceChart}>
                <XAxis dataKey="name" stroke={COLORS.axis} fontSize={11} />
                <YAxis stroke={COLORS.axis} fontSize={11} />
                <Tooltip contentStyle={{ background: '#f5f1e8', border: '1px solid #0a0a0b' }} />
                <Legend />
                <Bar dataKey="Quant" stackId="a" fill={COLORS.Quant} />
                <Bar dataKey="Verbal" stackId="a" fill={COLORS.Verbal} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Trajectory: practice test scores */}
      {testTraj.length > 0 && (
        <section>
          <Header n="03" title="Practice test trajectory" sub="Baseline 296 → Target 328. Are you trending?" />
          <div className="h-72 border border-ink/20 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={testTraj}>
                <XAxis dataKey="name" stroke={COLORS.axis} fontSize={11} />
                <YAxis stroke={COLORS.axis} fontSize={11} domain={[280, 340]} />
                <Tooltip contentStyle={{ background: '#f5f1e8', border: '1px solid #0a0a0b' }} />
                <Legend />
                <Line type="monotone" dataKey="Total" stroke={COLORS.Quant} strokeWidth={2.5} dot={{ r: 5 }} />
                <Line type="monotone" dataKey="Q" stroke={COLORS.Verbal} strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="V" stroke="#8b4513" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Weekly rollup table */}
      <section>
        <Header n="04" title="Weekly rollup" sub="Hours done vs. target — flag any week off-pace." />
        <div className="border border-ink/20 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink/15 bg-ink/5">
              <tr className="text-xs uppercase tracking-widest font-mono text-muted">
                <th className="text-left p-3">Wk</th>
                <th className="text-left p-3">Focus</th>
                <th className="text-left p-3">Phase</th>
                <th className="text-right p-3">Hrs Tgt</th>
                <th className="text-right p-3">Hrs Done</th>
                <th className="text-right p-3">Δ</th>
                <th className="text-right p-3">Days Active</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((w: any) => {
                const delta = (w.hours_done ?? 0) - (w.hours_target ?? 0);
                return (
                  <tr key={w.week_label} className="border-b border-ink/10 hover:bg-ink/[0.02]">
                    <td className="p-3 font-mono font-medium">{w.week_label}</td>
                    <td className="p-3">{w.focus}</td>
                    <td className="p-3">
                      <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 phase-${(w.phase ?? '').replace(' ', '')}`}>
                        {w.phase}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">{w.hours_target}</td>
                    <td className="p-3 text-right font-mono">{w.hours_done ?? '—'}</td>
                    <td className={`p-3 text-right font-mono ${delta < -2 ? 'text-accent' : delta > 0 ? 'text-ink' : 'text-muted'}`}>
                      {w.hours_done != null ? (delta > 0 ? '+' : '') + delta.toFixed(1) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono">{w.days_active ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Header({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-4">
      <span className="tag-num text-accent text-2xl font-bold">{n}</span>
      <div>
        <h3 className="font-display text-2xl font-bold">{title}</h3>
        <p className="text-xs uppercase tracking-widest text-muted font-mono mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="border-2 border-dashed border-ink/15 p-8 text-center text-sm text-muted">{msg}</div>;
}
