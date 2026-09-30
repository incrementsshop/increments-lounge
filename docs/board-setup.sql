-- The Increments Lounge — shared notice board
-- Run once in Supabase → SQL Editor → New query → Run. Safe to re-run.
--
-- What it sets up:
--   • a table of notes, each "pending" until the team approves it
--   • row-level security: the public key can ONLY add pending notes and read approved ones
--   • server-side checks (length, no links/emails) and a rate limit per visitor

create table if not exists public.increments (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  text        text not null,
  name        text,
  city        text,
  status      text not null default 'pending',
  ip_hash     text
);

alter table public.increments drop constraint if exists increments_text_len;
alter table public.increments add constraint increments_text_len check (char_length(text) between 3 and 80);
alter table public.increments drop constraint if exists increments_who_len;
alter table public.increments add constraint increments_who_len check (coalesce(char_length(name), 0) <= 24 and coalesce(char_length(city), 0) <= 32);
alter table public.increments drop constraint if exists increments_status;
alter table public.increments add constraint increments_status check (status in ('pending', 'approved', 'hidden'));
alter table public.increments drop constraint if exists increments_no_links;
alter table public.increments add constraint increments_no_links check (
  concat_ws(' ', text, name, city) !~* '(https?://|www\.|@|\m[a-z0-9-]+\.(com|ca|net|org|io|co|app|me|ly|gg|xyz)\M)'
);

create index if not exists increments_approved_idx on public.increments (created_at desc) where status = 'approved';
create index if not exists increments_ip_idx on public.increments (ip_hash, created_at desc);

-- Row-level security ----------------------------------------------------------
alter table public.increments enable row level security;

drop policy if exists "read approved notes" on public.increments;
create policy "read approved notes" on public.increments
  for select to anon using (status = 'approved');

drop policy if exists "submit notes for review" on public.increments;
create policy "submit notes for review" on public.increments
  for insert to anon with check (status = 'pending');

-- The public key may read only what the board shows, and write only the note itself.
revoke all on public.increments from anon, authenticated;
grant select (id, created_at, text, name, city, status) on public.increments to anon;
grant insert (text, name, city) on public.increments to anon;

-- Guard: tidy the note, force "pending", rate-limit ----------------------------
create or replace function public.increments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  ip text := coalesce(nullif(split_part(headers ->> 'x-forwarded-for', ',', 1), ''), headers ->> 'x-real-ip', 'unknown');
begin
  new.status  := 'pending';
  new.ip_hash := md5(ip || ':increments-lounge');
  new.text    := btrim(regexp_replace(new.text, '\s+', ' ', 'g'));
  new.name    := nullif(btrim(regexp_replace(coalesce(new.name, ''), '\s+', ' ', 'g')), '');
  new.city    := nullif(btrim(regexp_replace(coalesce(new.city, ''), '\s+', ' ', 'g')), '');

  if (select count(*) from public.increments
      where ip_hash = new.ip_hash and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many notes from here — try again in a little while.' using errcode = 'P0001';
  end if;

  if (select count(*) from public.increments
      where status = 'pending' and created_at > now() - interval '1 day') >= 300 then
    raise exception 'The board is full for today — thank you! Try again tomorrow.' using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists increments_guard on public.increments;
create trigger increments_guard before insert on public.increments
  for each row execute function public.increments_guard();

-- Handy for moderating (run in the SQL Editor):
--   select id, created_at, text, name, city from increments where status = 'pending' order by created_at;
--   update increments set status = 'approved' where id in (12, 13, 15);
--   update increments set status = 'hidden'   where id = 14;
