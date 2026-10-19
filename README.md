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
   Then run [supabase/patch-company-only.sql](supabase/patch-company-only.sql) the same way: it limits
   everything to `@villacartegroup.com` accounts (no `+alias` addresses) and locks image edits after the deadline.
   Finally run [supabase/patch-thumbnails.sql](supabase/patch-thumbnails.sql): it adds the thumbnail columns and caps
   uploads at 20 MB (photos are resized to well under 1 MB; videos are stored as uploaded).
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

## Free-plan capacity

The gallery shows ~25 KB thumbnails (a still frame for videos) and only loads the full file when an entry is
opened; uploads are cached for a year. That keeps a few hundred people comfortably inside Supabase's free
limits (1 GB storage, 5 GB + 5 GB cached downloads per month). Videos are the main storage cost, hence the 20 MB cap.

## Testing the rules

[supabase/test-rules.sql](supabase/test-rules.sql) simulates six users and checks uploads, votes (one per category,
changeable), the company-only gate, result hiding and the edit locks (39 checks). It temporarily swaps the
schedule functions, so **run it only in a throwaway test project**, never the live one. It rolls itself back and
ends with an error that carries the PASS/FAIL report.
