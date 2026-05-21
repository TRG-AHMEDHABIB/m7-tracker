# Deployment guide

End-to-end: from zero to a running URL on your phone in ~15 minutes.

## Part 1 — Supabase (5 min)

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Name: `m7-gre-tracker`. Pick the nearest region. Choose a strong password (you won't need it often). Wait ~2 min for provisioning.
3. Once ready, click **SQL Editor** (left sidebar) → **New query**.
4. Open `supabase/01_schema.sql` in your editor, copy the entire contents, paste into the Supabase SQL editor, click **Run**. You should see "Success. No rows returned."
5. New query. Paste `supabase/02_seed.sql`. Run. This inserts 372 tasks + 13 weekly goals + 8 tests + 60 quant topics. Should take ~2 seconds.
6. Go to **Project Settings → API**. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public key** (long JWT string)
   - Keep them in a notepad — you'll paste them into Lovable next.

**Verify it worked:** In Supabase, go to **Table Editor → tasks**. You should see 372 rows. Sort by `task_date`; first row is `2026-05-25`, last is `2026-08-22`.

## Part 2 — Lovable.dev (or Vercel) (10 min)

### Option A — Lovable

1. Go to [lovable.dev](https://lovable.dev) → **New Project**.
2. Choose **Import from GitHub** (push this folder to a new repo first — Lovable doesn't accept folder uploads directly).
   - Or: choose **Start from scratch** and ask Lovable's AI: *"Replicate this Next.js + Supabase project for me"* and drag the folder zipped — Lovable will scaffold the file tree.
3. In Lovable project settings → **Environment Variables**, add both:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
4. Click **Deploy**. Lovable runs `npm install && npm run build && npm start` and gives you a `*.lovable.app` URL.
5. Open on your phone. Add to home screen (Safari: share → Add to Home Screen; Chrome: ⋮ → Install app). Behaves like a native app.

### Option B — Vercel (if you prefer)

1. Push this folder to GitHub.
2. [vercel.com](https://vercel.com) → **Import Project** → pick the repo.
3. Add the same two env vars under Project Settings → Environment Variables.
4. Deploy. Vercel gives you a `*.vercel.app` URL.

## Part 3 — Add the test date to your calendar

Already done in the existing tracker, but if not: Saturday August 22, 2026 — schedule the actual GRE at [ets.org/gre/test-takers/general-test/register](https://www.ets.org/gre/test-takers/general-test/register) **now** before slots fill.

## Part 4 — Optional: Google Sheets sync

You asked about Sheets writeback. The clean way:

**Easy version (recommended):** Use the **↓ Export CSV** button on the Error Log tab. Open Google Sheets → File → Import → Upload the CSV → "Replace current sheet." Takes 10 seconds, gives you the full pivot-table power of Sheets on top of your data. Do this weekly during your Sunday review.

**Advanced version (auto-sync):** Build a Supabase Edge Function that runs nightly:

```ts
// supabase/functions/sync-to-sheets/index.ts
import { google } from 'npm:googleapis';
// Reads error_log → writes to a Google Sheet via Sheets API
// Requires a Google Cloud service account + sheet shared with that account
```

Steps:

1. Create a Google Cloud service account at [console.cloud.google.com](https://console.cloud.google.com) → IAM & Admin → Service Accounts → "Create".
2. Enable Sheets API for the project.
3. Download the JSON key. Share your target Google Sheet with the service-account email (`...@...iam.gserviceaccount.com`) as Editor.
4. Add to Supabase secrets: `supabase secrets set GOOGLE_SHEETS_KEY="$(cat key.json)"` and `SHEET_ID="<id from sheet URL>"`.
5. Deploy the Edge Function. Schedule it nightly with `pg_cron` or run on-demand.

Honestly, for a single-user 13-week sprint, the CSV export is faster, more reliable, and gives you the same outcome. Only build the auto-sync if you genuinely enjoy plumbing.

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank dashboard, no tasks | Check env vars are set in Lovable/Vercel. Hard-refresh the deployment. |
| "No tasks scheduled for this date" | Set the date picker (top right) to a date between May 25 — Aug 22, 2026. |
| Smart-reschedule button says "0 task moved" | Either nothing was undone, or you're already on the last day of the phase. |
| Repeat-pattern flag isn't appearing | Same section + question type + topic must already exist. Try logging 2 entries with `section=Quant`, `question_type=Geometry`, `topic=triangle inequality`. |
| Charts blank | You need at least one error-log entry. Add one. |
