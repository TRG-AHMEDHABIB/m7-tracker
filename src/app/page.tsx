'use client';

import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import TodayPanel from '@/components/TodayPanel';
import ErrorLogPanel from '@/components/ErrorLogPanel';
import ProgressPanel from '@/components/ProgressPanel';
import PlanPanel from '@/components/PlanPanel';

const TEST_DATE = new Date('2026-08-22');

type Tab = 'today' | 'errors' | 'progress' | 'plan';

export default function Home() {
  const [tab, setTab] = useState<Tab>('today');
  const [today, setToday] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Allow overriding "today" for review/planning
  const daysOut = differenceInDays(TEST_DATE, new Date());

  return (
    <main className="min-h-screen bg-paper text-ink bg-grid">
      <Header today={today} setToday={setToday} daysOut={daysOut} tab={tab} setTab={setTab} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'today' && <TodayPanel currentDate={today} />}
        {tab === 'errors' && <ErrorLogPanel />}
        {tab === 'progress' && <ProgressPanel />}
        {tab === 'plan' && <PlanPanel />}
      </div>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-ink/10 mt-12 text-xs text-muted font-mono">
        Operation M7 · GRE Aug 22, 2026 · Target 328 · Baseline 296
      </footer>
    </main>
  );
}

function Header({
  today, setToday, daysOut, tab, setTab,
}: { today: string; setToday: (s: string) => void; daysOut: number; tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <header className="border-b border-ink/15 bg-paper sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-6">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            OPERATION M7
          </h1>
          <span className="tag-num text-xs uppercase text-muted">
            {daysOut > 0 ? `${daysOut} days out` : daysOut === 0 ? 'TEST DAY' : 'post-test'}
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {(['today','errors','progress','plan'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm uppercase tracking-wider font-medium border ${
                tab === t
                  ? 'bg-ink text-paper border-ink'
                  : 'border-ink/15 hover:border-ink/40'
              }`}
            >
              {t === 'today' ? 'Today' : t === 'errors' ? 'Error Log' : t === 'progress' ? 'Progress' : 'Plan I/O'}
            </button>
          ))}
        </nav>

        <input
          type="date"
          value={today}
          onChange={e => setToday(e.target.value)}
          className="bg-transparent border border-ink/20 px-3 py-2 text-sm font-mono"
        />
      </div>
    </header>
  );
}
