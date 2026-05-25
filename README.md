# Operation M7 —  Prep Tracker

**13-week plan · May 25 → Aug 22, 2026 · Target 328 (baseline 296)**

A Next.js + Supabase app that replaces your spreadsheet with a writeback-enabled
dashboard. Pre-seeded with all 372 tasks across 90 days from the original
gmat-calibrated plan. **No pre-built rest days** — the plan is what it is.
Take rest opportunistically using the app's flex buttons when you actually
need it.

## What's inside

```
m7--tracker/
├── supabase/
│   ├── 01_schema.sql      ← tables, views, 4 SQL functions
│   └── 02_seed.sql        ← 372 tasks (rest days baked in), 13 weeks, 8 tests, 60 topics
├── src/
│   ├── app/               ← Next.js app-router pages
│   ├── components/
│   │   ├── TodayPanel.tsx       ← daily checklist + missed-day + busy-day buttons
│   │   ├── ErrorLogPanel.tsx    ← full error log w/ filters + reattempt + CSV export
│   │   ├── ProssPanel.tsx    ← pivot charts + weekly rollup
│   │   └── PlanPanel.tsx        ← JSON export/import for GPT roundtrip
│   └── lib/supabase.ts
├── docs/
│   ├── DEPLOY.md          ← Supabase + Lovable step-by-step
│   ├── ANKI.md            ← deck recommendation + install
│   └── SCHEDULING.md      ← all three flex mechanisms explained
└── package.json
```

## Four tabs

### Today
Daily checklist. Two flex buttons on the sidebar:
- **Redistribute N undone tasks** — for when you missed today (or fell short). Pushes tasks forward within the current phase, capping daily load at 1.5× phase average. Skips Fridays and test days.
- **Cap at 30 / 60 min** — for when tomorrow is a brutal work day. Caps the day at your chosen minutes, pushes the rest to the lightest of the next 3 days.

### Error Log
Full rigorous logging: section, question type, source, source-ref, topic, difficulty, what-went-wrong, fix, tags, time-spent. Auto-flags repeat patterns (same section + type + topic ≥2 times). One-click re-attempt tracking. CSV export for Google Sheets.

### Pross
Three pivot charts wired to SQL views:
- Errors by question type (your weak-spot ranking)
- Errors by source × section (which book/test is breaking you)
- Practice test trajectory (296 → 328)

Plus a weekly rollup table with hours-done vs. target Δ column.

### Plan I/O
**The key tab for AI iteration.** Export your current plan as JSON, paste into GPT with a constraint-aware prompt, paste the revised JSON back. Your done-state is preserved on import. Use for any change the flex buttons can't handle ("move test date by a week", "swap Manhattan for ETS Official Guide", "shift PTO week").

## Quick start

1. **Supabase** — Create free project. SQL Editor → run `supabase/01_schema.sql`, then `supabase/02_seed.sql`.
2. **Lovable** — Push to GitHub, import in Lovable, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars, deploy.
3. **Open on phone, add to home screen.** That's it.

Full guide with screenshots: `docs/DEPLOY.md`.

## Anki

Use the **gmat AnkiWeb deck `962516846`** (~868 words, free). Your tracker is calibrated for it. Install steps + pacing in `docs/ANKI.md`.

## Tech notes

- Next.js 14 (app router), TypeScript, Tailwind.
- Supabase: RLS-enabled with open policies (single-user).
- All scheduling logic in SQL functions — atomic, network-safe.
- No auth flow built. Add Supabase magic-link in 10 lines if needed.
