# Deployment guide

End-to-end: from zero to a running URL on your phone in ~15 minutes.

## Part 1 — Supabase (5 min)

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Name it, pick the nearest region, choose a strong password. Wait ~2 min for provisioning.
3. Once ready, click **SQL Editor** (left sidebar) → **New query**.
4. Open `supabase/01_schema.sql`, copy the entire contents, paste into the SQL editor, click **Run**.
5. New query. Paste `supabase/02_seed.sql`. Run. Inserts 372 tasks + 13 weekly goals + 8 tests + 60 topics.
6. Go to **Project Settings → API**. Copy two values:
   - **Project URL** (`https://xxxxxx.supabase.co`)
   - **Publishable / anon key** (long string starting with `sb_publishable_...`)

**Verify it worked:** Table Editor → tasks → should see 372 rows. First row `2026-05-25`, last `2026-08-22`.

## Part 2 — Vercel (10 min)

1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → **Import Project** → pick the repo.
3. Before deploying, add two **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your publishable key
4. Click **Deploy**. Vercel gives you a `*.vercel.app` URL.
5. Open on your phone → browser menu → **Add to Home Screen**. Behaves like a native app.

## Part 3 — Optional: Google Sheets sync

**Easy (recommended):** Use the **Export** tab → Download All → import the CSVs into Google Sheets. Takes 10 seconds weekly during your Sunday review.

**Advanced (auto-sync):** Build a Supabase Edge Function that runs nightly via `pg_cron` to push data to a Google Sheet via the Sheets API. Only worth it if you genuinely need live sync — the manual CSV export covers most use cases.

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank dashboard, no tasks | Check env vars are set in Vercel. Hard-refresh. |
| "No tasks scheduled for this date" | Set the date picker to a date between May 25 — Aug 22, 2026. |
| Redistribute says "0 tasks moved" | Either nothing was undone, or you're on the last day of the phase. |
| Charts blank | Need at least one error-log entry. Add one on the Error Log tab. |
