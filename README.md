# M7 Tracker

**13-week plan · May 25 → Aug 22, 2026 · Target 328 (baseline 296)**

A Next.js + Supabase app that replaces your spreadsheet with a writeback-enabled
dashboard. Pre-seeded with all 372 tasks across 90 days. **No pre-built rest days** — the plan is what it is.
Take rest opportunistically using the app's flex buttons when you actually need it.

## What's inside

```
m7-tracker/
├── supabase/
│   ├── 01_schema.sql      ← tables, views, 4 SQL functions
│   └── 02_seed.sql        ← 372 tasks, 13 weeks, 8 tests, 60 topics
├── src/
│   ├── app/               ← Next.js app-router pages
│   ├── components/
│   │   ├── TodayPanel.tsx       ← daily checklist + missed-day + busy-day buttons
│   │   ├── CalendarPanel.tsx    ← month heatmap + day drill-down
│   │   ├── WeeklyGoalsPanel.tsx ← weekly targets, actuals, reflection
│   │   ├── TestsPanel.tsx       ← practice test scores + trajectory
│   │   ├── TopicsPanel.tsx      ← quant topics checklist
│   │   ├── ErrorLogPanel.tsx    ← full error log w/ filters + reattempt + CSV export
│   │   ├── ProgressPanel.tsx    ← pivot charts + weekly rollup
│   │   └── ExportPanel.tsx      ← CSV export for all tables
│   └── lib/supabase.ts
├── docs/
│   ├── DEPLOY.md          ← Supabase + Vercel step-by-step
│   └── SCHEDULING.md      ← all three flex mechanisms explained
└── package.json
```

## Eight tabs

### Today
Daily checklist. Two flex buttons on the sidebar:
- **Redistribute N undone tasks** — pushes undone tasks forward within the current phase, capping daily load at 1.5× the phase average.
- **Cap at 30 / 60 min** — for a light day. Caps at your chosen minutes, pushes the rest to the lightest of the next 3 days.

### Calendar
Month grid with daily load heatmap. Click any day to see its tasks. Dots show done vs. pending per task.

### Weekly
Per-week targets (hours, question counts, vocab). Fill in actuals and a reflection at the end of each week.

### Tests
Log practice test scores (verbal + quant). Trajectory bar tracks progress toward target.

### Topics
60 quant topics with Studied / Drilled / Mastered toggles and notes. Filter by status.

### Error Log
Full logging: section, question type, source, topic, what-went-wrong, fix, tags. Auto-flags repeat patterns. CSV export.

### Progress
Three pivot charts: errors by type, errors by source, weekly hours rollup.

### Export
Download any or all tables as CSV. Use weekly as a backup.

## Quick start

1. **Supabase** — Create free project. SQL Editor → run `supabase/01_schema.sql`, then `supabase/02_seed.sql`.
2. **Vercel** — Push to GitHub, import in Vercel, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars, deploy.
3. **Open on phone, add to home screen.** That's it.

Full guide: `docs/DEPLOY.md`.

## Tech notes

- Next.js 14 (app router), TypeScript, Tailwind.
- Supabase: RLS-enabled with open policies (single-user).
- All scheduling logic in SQL functions — atomic, network-safe.
- No auth flow built. Add Supabase magic-link in 10 lines if needed.
