-- Halloween Challenge schema. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: it drops and recreates the objects it owns (this deletes entries/votes).

-- ---------------------------------------------------------------- schedule
-- Thailand time (GMT+7). Keep in sync with config.ts.
create or replace function public.upload_open() returns boolean language sql stable as $$
  select now() between timestamptz '2026-10-19 00:00:00+07' and timestamptz '2026-10-30 18:00:00+07'
$$;
create or replace function public.voting_open() returns boolean language sql stable as $$
  select now() between timestamptz '2026-10-30 18:00:00+07' and timestamptz '2026-10-31 18:00:00+07'
$$;
create or replace function public.results_open() returns boolean language sql stable as $$
  select now() >= timestamptz '2026-10-31 18:00:00+07'
$$;

-- ------------------------------------------------------------------ tables
drop table if exists public.votes;
drop table if exists public.entries;

create table public.entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  category      text not null check (category in ('costume', 'decoration', 'pet')),
  user_name     text not null default '',
  user_photo    text not null default '',
  uploader_name text not null,
  name          text not null,
  position      text,
  description   text not null default '',
  media_url     text not null,
  media_path    text not null,
  media_type    text not null check (media_type in ('image', 'video')),
  thumb_url     text,
  thumb_path    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, category)            -- one entry per person per category
);

create table public.votes (
  voter_id  uuid not null references auth.users (id) on delete cascade,
  category  text not null check (category in ('costume', 'decoration', 'pet')),
  entry_id  uuid not null references public.entries (id) on delete cascade,
  voted_at  timestamptz not null default now(),
  primary key (voter_id, category)      -- one vote per person per category
);

-- ---------------------------------------------------------------- security
alter table public.entries enable row level security;
alter table public.votes   enable row level security;

-- Everyone signed in can browse entries; owners manage their own while uploads are open.
create policy entries_read   on public.entries for select to authenticated using (true);
create policy entries_insert on public.entries for insert to authenticated
  with check (user_id = auth.uid() and public.upload_open());
create policy entries_update on public.entries for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.upload_open());
create policy entries_delete on public.entries for delete to authenticated
  using (user_id = auth.uid() and public.upload_open());

-- Votes are private: you can only see your own, and you can only write them through cast_vote().
create policy votes_read_own on public.votes for select to authenticated using (voter_id = auth.uid());

create or replace function public.cast_vote(p_entry uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e public.entries%rowtype;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if not public.voting_open() then raise exception 'Voting is not open'; end if;
  select * into e from public.entries where id = p_entry;
  if not found then raise exception 'Entry not found'; end if;
  if e.user_id = auth.uid() then raise exception 'You cannot vote for yourself'; end if;
  insert into public.votes (voter_id, category, entry_id) values (auth.uid(), e.category, p_entry)
  on conflict (voter_id, category) do update set entry_id = excluded.entry_id, voted_at = now();
end $$;

-- Vote totals are only released once results open, so nobody can peek early.
create or replace function public.get_results() returns table (entry_id uuid, vote_count bigint)
language sql stable security definer set search_path = public as $$
  select e.id, count(v.entry_id)
  from public.entries e
  left join public.votes v on v.entry_id = e.id
  where public.results_open()
  group by e.id
$$;

revoke execute on function public.cast_vote(uuid) from public, anon;
revoke execute on function public.get_results()   from public, anon;
grant  execute on function public.cast_vote(uuid) to authenticated;
grant  execute on function public.get_results()   to authenticated;

-- ----------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entries', 'entries', true, 20971520, array['image/*', 'video/*'])
on conflict (id) do update set public = true, file_size_limit = 20971520,
  allowed_mime_types = array['image/*', 'video/*'];

drop policy if exists entries_files_insert on storage.objects;
drop policy if exists entries_files_update on storage.objects;
drop policy if exists entries_files_delete on storage.objects;
-- Files live under <user id>/..., and only that user may add or remove them.
create policy entries_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'entries' and (storage.foldername(name))[1] = auth.uid()::text and public.upload_open());
create policy entries_files_update on storage.objects for update to authenticated
  using (bucket_id = 'entries' and (storage.foldername(name))[1] = auth.uid()::text);
create policy entries_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'entries' and (storage.foldername(name))[1] = auth.uid()::text and public.upload_open());

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.entries;

-- ------------------------------------------------------------- next step
-- Then run supabase/patch-company-only.sql: it limits the app to company accounts and makes
-- the storage policies time-aware. (Kept as a separate file so it can be applied to a live
-- database without re-running this script, which drops the entries and votes tables.)
