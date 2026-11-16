# Wander Passport

A travel dream board, AI trip planner and photo memories, backed by Supabase and hosted on Vercel.

- `index.html`, `app.js` — the app (static, no build step)
- `supa.js` — Supabase adapter: email sign-in, Postgres tables with row-level security, private photo storage, AI via the `ai` Edge Function
- Supabase project: `wander-passport` (ap-south-1)

AI features need the `ANTHROPIC_API_KEY` secret set on the Supabase project (Edge Functions → Secrets). Without it the app uses starter plans.
