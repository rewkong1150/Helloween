-- Rules test harness. RUN ONLY IN A THROWAWAY TEST PROJECT, never in the live one: it temporarily
-- replaces the schedule functions to simulate the contest days.
-- It simulates six users, checks uploads/votes/results/locks, then ends with an error that carries the
-- report. That error rolls the whole transaction back, so nothing is left behind.
-- Install supabase/schema.sql + patch-company-only.sql first, then run this in the SQL Editor.

create function public.tt_as_auth(uid uuid, mail text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function public.tt_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end $$;

create function public.tt_try(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

create function public.tt_rows(q text) returns text language plpgsql as $$
declare n int;
begin execute q; get diagnostics n = row_count; return n::text; exception when others then return 'ERR: ' || sqlerrm; end $$;

create function public.tt_val(q text) returns text language plpgsql as $$
declare v text;
begin execute q into v; return coalesce(v, 'null'); exception when others then return 'ERR: ' || sqlerrm; end $$;

create function public.tt_line(label text, got text, expected text) returns text language sql as $$
  select case when got like expected then 'PASS ' else 'FAIL ' end || label || '   [got: ' || got || ']' || E'\n'
$$;

do $do$
declare
  a  uuid := '10000000-0000-0000-0000-00000000000a';
  b  uuid := '10000000-0000-0000-0000-00000000000b';
  c  uuid := '10000000-0000-0000-0000-00000000000c';
  d  uuid := '10000000-0000-0000-0000-00000000000d';
  x  uuid := '10000000-0000-0000-0000-00000000000e';
  p  uuid := '10000000-0000-0000-0000-00000000000f';
  ea uuid := '20000000-0000-0000-0000-00000000000a';
  eb uuid := '20000000-0000-0000-0000-00000000000b';
  ec uuid := '20000000-0000-0000-0000-00000000000c';
  ed uuid := '20000000-0000-0000-0000-00000000000d';
  r text := '';
  fails int;
begin
  -- fixtures: alice(a) bob(b) carol(c) dave(d) are company users, eve(x) is an outsider, frank+1(p) uses an alias
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'alice@villacartegroup.com'),
    (b, 'authenticated', 'authenticated', 'bob@villacartegroup.com'),
    (c, 'authenticated', 'authenticated', 'carol@villacartegroup.com'),
    (d, 'authenticated', 'authenticated', 'dave@villacartegroup.com'),
    (x, 'authenticated', 'authenticated', 'eve@gmail.com'),
    (p, 'authenticated', 'authenticated', 'frank+1@villacartegroup.com');
  insert into public.entries (id, user_id, category, uploader_name, name, media_url, media_path, media_type) values
    (ea, a, 'pet',     'A', 'A pet',     'u', 'p', 'image'),
    (eb, b, 'pet',     'B', 'B pet',     'u', 'p', 'image'),
    (ec, c, 'costume', 'C', 'C costume', 'u', 'p', 'image'),
    (ed, d, 'pet',     'D', 'D pet',     'u', 'p', 'image');

  -- 1. voting is closed on the real schedule (it opens on the 30th at 18:00)
  perform public.tt_as_auth(a, 'alice@villacartegroup.com');
  r := r || public.tt_line('vote before the 30th 18:00 is refused', public.tt_try(format('select public.cast_vote(%L)', eb)), 'Voting is not open');
  r := r || public.tt_line('results hidden before the end', public.tt_val('select count(*) from public.get_results()'), '0');

  -- simulate the voting day (test project only)
  reset role;
  execute $f$create or replace function public.voting_open() returns boolean language sql stable as 'select true'$f$;

  -- 2. one vote per category, changeable
  perform public.tt_as_auth(a, 'alice@villacartegroup.com');
  r := r || public.tt_line('cannot vote for own entry', public.tt_try(format('select public.cast_vote(%L)', ea)), 'You cannot vote for yourself');
  r := r || public.tt_line('vote pet entry B', public.tt_try(format('select public.cast_vote(%L)', eb)), 'ok');
  r := r || public.tt_line('vote costume entry C (other category)', public.tt_try(format('select public.cast_vote(%L)', ec)), 'ok');
  r := r || public.tt_line('2 votes = one per category', public.tt_val(format('select count(*) from public.votes where voter_id = %L', a)), '2');
  r := r || public.tt_line('change pet vote to D', public.tt_try(format('select public.cast_vote(%L)', ed)), 'ok');
  r := r || public.tt_line('still exactly 2 votes after changing', public.tt_val(format('select count(*) from public.votes where voter_id = %L', a)), '2');
  r := r || public.tt_line('pet vote now points to D', public.tt_val(format('select entry_id from public.votes where voter_id = %L and category = ''pet''', a)), ed::text);
  r := r || public.tt_line('voting again for the same entry is harmless', public.tt_try(format('select public.cast_vote(%L)', ed)), 'ok');

  -- 3. votes can only be written through cast_vote()
  r := r || public.tt_line('direct insert into votes blocked', public.tt_try(format('insert into public.votes (voter_id, category, entry_id) values (%L, ''pet'', %L)', a, eb)), '%row-level security%');
  r := r || public.tt_line('direct update of votes changes 0 rows', public.tt_rows(format('update public.votes set entry_id = %L where voter_id = %L', eb, a)), '0');
  r := r || public.tt_line('direct delete of votes removes 0 rows', public.tt_rows(format('delete from public.votes where voter_id = %L', a)), '0');

  perform public.tt_as_auth(c, 'carol@villacartegroup.com');
  r := r || public.tt_line('carol votes pet entry A', public.tt_try(format('select public.cast_vote(%L)', ea)), 'ok');
  perform public.tt_as_auth(b, 'bob@villacartegroup.com');
  r := r || public.tt_line('bob votes pet entry A', public.tt_try(format('select public.cast_vote(%L)', ea)), 'ok');
  r := r || public.tt_line('bob only sees his own vote', public.tt_val('select count(*) from public.votes'), '1');

  -- 4. only company accounts
  perform public.tt_as_auth(x, 'eve@gmail.com');
  r := r || public.tt_line('outsider cannot vote', public.tt_try(format('select public.cast_vote(%L)', eb)), 'Company accounts only');
  r := r || public.tt_line('outsider sees no entries', public.tt_val('select count(*) from public.entries'), '0');
  r := r || public.tt_line('outsider cannot upload', public.tt_try(format('insert into public.entries (user_id, category, uploader_name, name, media_url, media_path, media_type) values (%L, ''costume'', ''x'', ''x'', ''u'', ''p'', ''image'')', x)), '%row-level security%');
  perform public.tt_as_auth(p, 'frank+1@villacartegroup.com');
  r := r || public.tt_line('+alias address cannot vote', public.tt_try(format('select public.cast_vote(%L)', eb)), 'Company accounts only');
  perform public.tt_as_anon();
  r := r || public.tt_line('signed-out user cannot vote', public.tt_try(format('select public.cast_vote(%L)', eb)), 'permission denied%');
  r := r || public.tt_line('signed-out user cannot read results', public.tt_try('select * from public.get_results()'), 'permission denied%');
  r := r || public.tt_line('signed-out user sees no entries', public.tt_val('select count(*) from public.entries'), '0');

  -- 5. results appear only after voting ends
  reset role;
  execute $f$create or replace function public.results_open() returns boolean language sql stable as 'select true'$f$;
  perform public.tt_as_auth(a, 'alice@villacartegroup.com');
  r := r || public.tt_line('results: A got carol+bob = 2', public.tt_val(format('select vote_count from public.get_results() where entry_id = %L', ea)), '2');
  r := r || public.tt_line('results: D got alice = 1', public.tt_val(format('select vote_count from public.get_results() where entry_id = %L', ed)), '1');
  r := r || public.tt_line('results: C got alice = 1', public.tt_val(format('select vote_count from public.get_results() where entry_id = %L', ec)), '1');
  r := r || public.tt_line('results: B lost alices vote = 0', public.tt_val(format('select vote_count from public.get_results() where entry_id = %L', eb)), '0');
  perform public.tt_as_auth(x, 'eve@gmail.com');
  r := r || public.tt_line('outsider cannot read results', public.tt_val('select count(*) from public.get_results()'), '0');

  -- 6. entries: one per category, editable until uploads close
  reset role;
  execute $f$create or replace function public.upload_open() returns boolean language sql stable as 'select false'$f$;
  perform public.tt_as_auth(a, 'alice@villacartegroup.com');
  r := r || public.tt_line('after close: cannot edit own entry', public.tt_rows(format('update public.entries set name = ''locked'' where id = %L', ea)), 'ERR: %row-level security%');
  r := r || public.tt_line('after close: cannot delete own entry', public.tt_rows(format('delete from public.entries where id = %L', ea)), '0');
  r := r || public.tt_line('after close: cannot add an entry', public.tt_try(format('insert into public.entries (user_id, category, uploader_name, name, media_url, media_path, media_type) values (%L, ''decoration'', ''a'', ''a'', ''u'', ''p'', ''image'')', a)), '%row-level security%');
  reset role;
  execute $f$create or replace function public.upload_open() returns boolean language sql stable as 'select true'$f$;
  perform public.tt_as_auth(a, 'alice@villacartegroup.com');
  r := r || public.tt_line('while open: can edit own entry', public.tt_rows(format('update public.entries set name = ''edited'' where id = %L', ea)), '1');
  r := r || public.tt_line('while open: cannot edit someone elses entry', public.tt_rows(format('update public.entries set name = ''hacked'' where id = %L', eb)), '0');
  r := r || public.tt_line('while open: cannot hand an entry to someone else', public.tt_try(format('update public.entries set user_id = %L where id = %L', b, ea)), '%row-level security%');
  r := r || public.tt_line('while open: can add a new category', public.tt_try(format('insert into public.entries (user_id, category, uploader_name, name, media_url, media_path, media_type) values (%L, ''decoration'', ''a'', ''a'', ''u'', ''p'', ''image'')', a)), 'ok');
  r := r || public.tt_line('while open: second entry in same category refused', public.tt_try(format('insert into public.entries (user_id, category, uploader_name, name, media_url, media_path, media_type) values (%L, ''decoration'', ''a'', ''a2'', ''u'', ''p'', ''image'')', a)), '%duplicate key%');
  r := r || public.tt_line('while open: cannot upload as someone else', public.tt_try(format('insert into public.entries (user_id, category, uploader_name, name, media_url, media_path, media_type) values (%L, ''costume'', ''a'', ''a'', ''u'', ''p'', ''image'')', b)), '%row-level security%');
  r := r || public.tt_line('while open: can delete own entry', public.tt_rows(format('delete from public.entries where id = %L', ea)), '1');
  reset role;
  r := r || public.tt_line('deleting an entry removes the votes for it', public.tt_val(format('select count(*) from public.votes where entry_id = %L', ea)), '0');

  fails := (length(r) - length(replace(r, 'FAIL', ''))) / 4;
  raise exception E'\n===== TEST REPORT: % failed, % checks =====\n%', fails, (length(r) - length(replace(r, E'\n', ''))), r;
end $do$;
