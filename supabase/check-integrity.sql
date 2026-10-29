-- READ-ONLY health check for the live database. It only SELECTs: it changes nothing and returns
-- structure flags and counts, never entry titles, names or media. Safe to run during the contest.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Expected values are in the comments.

select
  -- one vote per person per category: expect  PRIMARY KEY (voter_id, category)
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.votes'::regclass and contype = 'p') as votes_primary_key,
  -- one entry per person per category: expect  UNIQUE (user_id, category)
  (select string_agg(pg_get_constraintdef(oid), '; ') from pg_constraint where conrelid = 'public.entries'::regclass and contype = 'u') as entries_unique,
  -- expect true / true
  (select relrowsecurity from pg_class where oid = 'public.votes'::regclass)   as votes_rls_on,
  (select relrowsecurity from pg_class where oid = 'public.entries'::regclass) as entries_rls_on,
  -- expect only the read policy: votes_read_own[SELECT]  (votes can only be written through cast_vote)
  (select string_agg(policyname || '[' || cmd || ']', ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'votes') as votes_policies,
  -- expect true x5: the functions contain the intended rules and no owner/test bypass
  (select pg_get_functiondef('public.cast_vote'::regproc) like '%on conflict (voter_id, category)%'
      and pg_get_functiondef('public.cast_vote'::regproc) like '%is_company_user%'
      and pg_get_functiondef('public.cast_vote'::regproc) like '%voting_open%'
      and pg_get_functiondef('public.cast_vote'::regproc) like '%cannot vote for yourself%') as cast_vote_ok,
  (select pg_get_functiondef('public.get_results'::regproc) like '%results_open() and public.is_company_user()%') as results_gated,
  (select pg_get_functiondef('public.voting_open'::regproc) like '%2026-10-30 00:00:00+07%'
      and pg_get_functiondef('public.voting_open'::regproc) like '%2026-10-30 23:59:59+07%'
      and pg_get_functiondef('public.voting_open'::regproc) not like '%@%') as voting_window_ok,
  (select pg_get_functiondef('public.results_open'::regproc) like '%2026-10-31 00:00:00+07%'
      and pg_get_functiondef('public.results_open'::regproc) not like '%@%') as results_window_ok,
  (select pg_get_functiondef('public.upload_open'::regproc) like '%2026-10-19 00:00:00+07%'
      and pg_get_functiondef('public.upload_open'::regproc) like '%2026-10-29 23:59:59+07%') as upload_window_ok,
  -- counts only
  (select count(*) from public.entries) as entries_total,
  (select string_agg(category || '=' || n, ', ' order by category) from (select category, count(*) n from public.entries group by category) t) as entries_by_category,
  (select count(*) from public.votes) as votes_total,                 -- expect 0 until voting opens on the 30th
  -- integrity, all expect 0
  (select count(*) from (select user_id, category from public.entries group by 1, 2 having count(*) > 1) t) as duplicate_entries,
  (select count(*) from (select voter_id, category from public.votes group by 1, 2 having count(*) > 1) t) as duplicate_votes,
  (select count(*) from public.votes v join public.entries e on e.id = v.entry_id where v.category <> e.category) as votes_in_wrong_category,
  (select count(*) from public.votes v join public.entries e on e.id = v.entry_id where e.user_id = v.voter_id) as self_votes,
  now() as server_time;
