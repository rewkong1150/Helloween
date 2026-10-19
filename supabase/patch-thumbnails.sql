-- Adds gallery thumbnails and a 20 MB upload limit. Does NOT touch existing data. Safe to run more than once.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.

alter table public.entries add column if not exists thumb_url  text;
alter table public.entries add column if not exists thumb_path text;

-- Videos are stored as uploaded, so cap every file at 20 MB (photos are resized to well under 1 MB).
update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['image/*', 'video/*']
where id = 'entries';
