# Halloween Challenge

Staff contest with three categories — **Best Costume**, **Best Decoration/Prop**, **Best Pet Look**.
Everyone uploads up to one entry per category and casts one vote per category (not for their own entry).
React + Vite + Supabase (auth, Postgres, storage). No credit card needed on the Supabase free plan.

## Run locally

```
npm install
npm run dev
```

## One-time Supabase setup

Project: `Helloween` (`paxsksbabtoznakdbxcb`). Do these in the Supabase dashboard:

1. **SQL Editor** → New query → paste all of [supabase/schema.sql](supabase/schema.sql) → Run.
   Creates the tables, security policies, the vote/results functions and the storage bucket.
2. **Authentication → URL Configuration**: set *Site URL* to where the app is served and add the same
   address (e.g. `http://localhost:8080/`) under *Redirect URLs*.
3. **Authentication → Providers → Google**: enable it and paste a Google OAuth client ID/secret
   (Google Cloud Console → APIs & Services → Credentials; authorised redirect URI is shown in the
   Supabase provider page). Email sign-in works without this, but Supabase's built-in mail sender is
   limited to a few emails per hour.

## Schedule

Defined in [config.ts](config.ts) for the UI and in `upload_open()`, `voting_open()`, `results_open()` in
[supabase/schema.sql](supabase/schema.sql), which is what the server enforces. Change both together.
Vote totals are hidden by the server until results open.
