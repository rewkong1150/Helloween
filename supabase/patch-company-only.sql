-- Security patch for an already-installed database (does NOT touch your data).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--   1. Only company accounts can read, upload or vote.
--   2. The image file can no longer be replaced after uploads close.

-- Company accounts: <name>@villacartegroup.com, with no "+alias" (so one inbox cannot make many accounts).
-- The extra address is the contest owner's own account; delete it from the list before launch if not needed.
create or replace function public.is_company_user() returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') ~* '^[^+@]+@villacartegroup\.com$'
      or lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['rewkong1150@gmail.com'])
$$;

-- ------------------------------------------------------------------ entries
drop policy if exists entries_read   on public.entries;
drop policy if exists entries_insert on public.entries;
drop policy if exists entries_update on public.entries;
drop policy if exists entries_delete on public.entries;

create policy entries_read   on public.entries for select to authenticated
  using (public.is_company_user());
create policy entries_insert on public.entries for insert to authenticated
  with check (user_id = auth.uid() and public.upload_open() and public.is_company_user());
create policy entries_update on public.entries for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.upload_open() and public.is_company_user());
create policy entries_delete on public.entries for delete to authenticated
  using (user_id = auth.uid() and public.upload_open());

-- -------------------------------------------------------------------- votes
drop policy if exists votes_read_own on public.votes;
create policy votes_read_own on public.votes for select to authenticated
  using (voter_id = auth.uid() and public.is_company_user());

create or replace function public.cast_vote(p_entry uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e public.entries%rowtype;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if not public.is_company_user() then raise exception 'Company accounts only'; end if;
  if not public.voting_open() then raise exception 'Voting is not open'; end if;
  select * into e from public.entries where id = p_entry;
  if not found then raise exception 'Entry not found'; end if;
  if e.user_id = auth.uid() then raise exception 'You cannot vote for yourself'; end if;
  insert into public.votes (voter_id, category, entry_id) values (auth.uid(), e.category, p_entry)
  on conflict (voter_id, category) do update set entry_id = excluded.entry_id, voted_at = now();
end $$;

create or replace function public.get_results() returns table (entry_id uuid, vote_count bigint)
language sql stable security definer set search_path = public as $$
  select e.id, count(v.entry_id)
  from public.entries e
  left join public.votes v on v.entry_id = e.id
  where public.results_open() and public.is_company_user()
  group by e.id
$$;

-- ------------------------------------------------------------------ storage
drop policy if exists entries_files_insert on storage.objects;
drop policy if exists entries_files_update on storage.objects;
drop policy if exists entries_files_delete on storage.objects;

create policy entries_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'entries' and (storage.foldername(name))[1] = auth.uid()::text
              and public.upload_open() and public.is_company_user());
create policy entries_files_update on storage.objects for update to authenticated
  using (bucket_id = 'entries' and (storage.foldername(name))[1] = auth.uid()::text
         and public.upload_open() and public.is_company_user())
  with check (bucket_id = 'entries' and (storage.foldername(name))[1] = auth.uid()::text
              and public.upload_open() and public.is_company_user());
create policy entries_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'entries' and (storage.foldername(name))[1] = auth.uid()::text and public.upload_open());

-- Deleting or replacing a file needs SELECT on it as well; without this storage.remove() silently
-- did nothing and old files piled up. Own files only.
drop policy if exists entries_files_select on storage.objects;
create policy entries_files_select on storage.objects for select to authenticated
  using (bucket_id = 'entries' and (storage.foldername(name))[1] = auth.uid()::text);
