'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface QuantTopic {
  id: string;
  sort_order: number;
  category: string;
  topic: string;
  notes: string | null;
  studied: boolean;
  drilled: boolean;
  mastered: boolean;
}

type Filter = 'all' | 'todo' | 'in-progress' | 'mastered';

export default function TopicsPanel() {
  const [topics, setTopics] = useState<QuantTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('quant_topics').select('*').order('sort_order');
    if (data) setTopics(data as QuantTopic[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggle(id: string, field: 'studied' | 'drilled' | 'mastered', value: boolean) {
    // optimistic
    setTopics(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    await supabase.from('quant_topics').update({ [field]: value }).eq('id', id);
  }

  async function updateNotes(id: string, notes: string) {
    await supabase.from('quant_topics').update({ notes: notes || null }).eq('id', id);
  }

  const byCategory = useMemo(() => {
    const map: Record<string, QuantTopic[]> = {};
    for (const t of topics) {
      const filtered =
        filter === 'all' ? true :
        filter === 'todo' ? !t.studied :
        filter === 'in-progress' ? (t.studied && !t.mastered) :
        t.mastered;
      if (!filtered) continue;
      (map[t.category] ??= []).push(t);
    }
    return map;
  }, [topics, filter]);

  const stats = useMemo(() => {
    const studied = topics.filter(t => t.studied).length;
    const drilled = topics.filter(t => t.drilled).length;
    const mastered = topics.filter(t => t.mastered).length;
    return { total: topics.length, studied, drilled, mastered };
  }, [topics]);

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between border-b border-ink/15 pb-4 flex-wrap gap-4">
        <h2 className="font-display text-4xl font-extrabold">Quant Topics</h2>
        <div className="flex items-baseline gap-6 text-xs font-mono uppercase tracking-widest text-muted">
          <span><span className="tag-num text-ink font-bold text-2xl">{stats.studied}</span>/{stats.total} studied</span>
          <span><span className="tag-num text-ink font-bold text-2xl">{stats.drilled}</span>/{stats.total} drilled</span>
          <span><span className="tag-num text-accent font-bold text-2xl">{stats.mastered}</span>/{stats.total} mastered</span>
        </div>
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        {(['all','todo','in-progress','mastered'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs uppercase tracking-widest border ${
              filter === f ? 'bg-ink text-paper border-ink' : 'border-ink/20 hover:border-ink/40'
            }`}
          >{f.replace('-', ' ')}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : Object.keys(byCategory).length === 0 ? (
        <div className="text-muted">Nothing matches this filter.</div>
      ) : (
        <div className="space-y-8">
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat}>
              <h3 className="font-display text-lg font-bold mb-3 border-b border-ink/10 pb-1">{cat}</h3>
              <ul className="space-y-1">
                {items.map(t => (
                  <li key={t.id} className="border border-ink/10 hover:border-ink/30 px-3 py-2 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center transition-colors">
                    <div>
                      <div className={`text-sm ${t.mastered ? 'text-muted line-through' : ''}`}>{t.topic}</div>
                      <input
                        defaultValue={t.notes ?? ''}
                        placeholder="notes / page ref"
                        onBlur={e => { if (e.target.value !== (t.notes ?? '')) updateNotes(t.id, e.target.value); }}
                        className="mt-1 w-full bg-transparent text-xs text-muted font-mono border-b border-transparent hover:border-ink/15 focus:border-ink/40 focus:outline-none"
                      />
                    </div>
                    <Checkbox label="Studied" checked={t.studied} onChange={v => toggle(t.id, 'studied', v)} />
                    <Checkbox label="Drilled" checked={t.drilled} onChange={v => toggle(t.id, 'drilled', v)} />
                    <Checkbox label="Mastered" checked={t.mastered} onChange={v => toggle(t.id, 'mastered', v)} accent />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Checkbox({ label, checked, onChange, accent }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; accent?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex flex-col items-center gap-1 group"
      title={label}
    >
      <span className={`w-5 h-5 border-2 flex items-center justify-center text-xs transition-colors ${
        checked
          ? (accent ? 'bg-accent border-accent text-paper' : 'bg-ink border-ink text-paper')
          : 'border-ink/30 group-hover:border-ink'
      }`}>{checked ? '✓' : ''}</span>
      <span className="text-[9px] uppercase tracking-widest font-mono text-muted">{label}</span>
    </button>
  );
}
