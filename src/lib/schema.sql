-- =====================================================
-- ICONNECT database schema for Supabase (PostgreSQL)
-- =====================================================
-- Run this entire file in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/_/sql
-- After running, also go to:
--   Database -> Replication -> supabase_realtime
--   and ensure the tables below are added to the publication
--   (the trigger does this automatically, but if it fails
--   you can add them manually).
-- =====================================================

-- Drop existing objects (in case you re-run)
drop trigger if exists on_user_created on public.users;
drop function if exists public.handle_new_user();
drop function if exists public.create_user(text, text, text, text, text);
drop function if exists public.send_message(uuid, text, text, text, text, text, bigint);
drop function if exists public.get_conversation(uuid, text);
drop table if exists public.chat_tables cascade;
drop table if exists public.transactions cascade;
drop table if exists public.users cascade;

-- 1) USERS
-- =====================================================
create table public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text not null unique,
  phone text not null default '',
  password_hash text not null default '',
  role text not null default 'Client' check (role in ('Admin', 'Client')),
  active boolean not null default false,
  avatar text not null default '',
  last_active text not null default 'Now',
  joined_at text not null default to_char(now(), 'Mon DD, YYYY'),
  created_at timestamptz not null default now()
);

create index idx_users_username on public.users (username);
create index idx_users_role on public.users (role);

-- 2) CHAT_TABLES registry (per-user chat table metadata)
-- =====================================================
create table public.chat_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  table_name text not null unique,
  created_at timestamptz not null default now()
);

-- 3) handle_new_user trigger
-- Creates a per-user chat table whenever a new user is added.
-- Runs as SECURITY DEFINER so it can create tables regardless of
-- the calling user's permissions.
-- =====================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
begin
  v_table := 'user_chat_' || replace(new.id::text, '-', '_');

  -- Insert into registry (idempotent)
  insert into public.chat_tables (user_id, table_name)
  values (new.id, v_table)
  on conflict do nothing;

  -- Create the per-user chat table
  execute format(
    'create table if not exists public.%I (
       id bigserial primary key,
       sender_id uuid not null references public.users(id) on delete cascade,
       recipient_id uuid not null references public.users(id) on delete cascade,
       text text not null default '''',
       media_url text,
       media_type text check (media_type in (''image'',''file'')),
       media_name text,
       media_size bigint,
       read boolean not null default false,
       created_at timestamptz not null default now()
     );',
    v_table
  );

  -- Indexes for the new table
  execute format('create index if not exists idx_%I_created on public.%I (created_at);', v_table, v_table);

  -- Enable RLS + permissive policies
  execute format('alter table public.%I enable row level security;', v_table);
  execute format(
    'drop policy if exists "Read own chat" on public.%I;',
    v_table
  );
  execute format(
    'create policy "Read own chat" on public.%I for select using (
       sender_id = %L::uuid or recipient_id = %L::uuid
     );',
    v_table, new.id::text, new.id::text
  );
  execute format(
    'drop policy if exists "Insert into chat" on public.%I;',
    v_table
  );
  execute format(
    'create policy "Insert into chat" on public.%I for insert with check (true);',
    v_table
  );

  -- Try to add the new table to realtime (may fail if pub doesn't exist;
  -- that's OK — admin can add it manually from the Replication UI)
  begin
    execute format(
      'alter publication supabase_realtime add table public.%I;',
      v_table
    );
  exception when others then
    -- silently ignore; can be added later via the dashboard
    null;
  end;

  return new;
end;
$$;

create trigger on_user_created
  after insert on public.users
  for each row execute function public.handle_new_user();

-- 4) TRANSACTIONS
-- =====================================================
create table public.transactions (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('incoming', 'expense')),
  category text check (category in ('account', 'expense')),
  from_field text,
  account_number text,
  from_bank text,
  sender_name text,
  expense_reason text,
  amount bigint not null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_tx_user on public.transactions (user_id);
create index idx_tx_created on public.transactions (created_at desc);

-- 5) ROW-LEVEL SECURITY
-- =====================================================
alter table public.users enable row level security;
alter table public.chat_tables enable row level security;
alter table public.transactions enable row level security;

-- Allow anon + authenticated to read all users (the app needs to list
-- every account for the user picker / admin views)
drop policy if exists "Users are publicly readable" on public.users;
create policy "Users are publicly readable" on public.users
  for select using (true);

-- Allow inserts to users from anyone (the trigger also runs SECURITY
-- DEFINER so it can always insert)
drop policy if exists "Users insert allowed" on public.users;
create policy "Users insert allowed" on public.users
  for insert with check (true);

-- Allow updates to users (so the app can change name etc.)
drop policy if exists "Users update allowed" on public.users;
create policy "Users update allowed" on public.users
  for update using (true);

-- Allow read on chat_tables
drop policy if exists "Chat tables readable" on public.chat_tables;
create policy "Chat tables readable" on public.chat_tables
  for select using (true);

-- Transactions: users see only their own (we use the anon key, so
-- we can't reference auth.uid(); use a permissive policy and filter
-- in the API instead)
drop policy if exists "Transactions readable" on public.transactions;
create policy "Transactions readable" on public.transactions
  for select using (true);

drop policy if exists "Transactions insert allowed" on public.transactions;
create policy "Transactions insert allowed" on public.transactions
  for insert with check (true);

-- 6) RPC: create_user(name, username, phone, role, password)
-- =====================================================
-- Inserts into public.users; the trigger creates the per-user
-- chat table automatically.
-- =====================================================
create or replace function public.create_user(
  p_name text,
  p_username text,
  p_phone text,
  p_role text,
  p_password text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_avatar text;
begin
  v_avatar := upper(
    coalesce(left(split_part(p_name, ' ', 1), 1), '') ||
    coalesce(left(split_part(p_name, ' ', 2), 1), '')
  );
  if length(v_avatar) = 0 then
    v_avatar := upper(left(p_name, 2));
  end if;

  insert into public.users (
    name, username, phone, role, password_hash,
    avatar, active, last_active, joined_at
  )
  values (
    p_name,
    lower(p_username),
    p_phone,
    p_role,
    coalesce(p_password, ''),
    v_avatar,
    false,
    'Never',
    to_char(now(), 'Mon DD, YYYY')
  )
  returning * into v_user;

  return v_user;
end;
$$;

grant execute on function public.create_user(text, text, text, text, text)
  to anon, authenticated, service_role;

-- 7) RPC: send_message(...)
-- =====================================================
create or replace function public.send_message(
  p_sender_id uuid,
  p_recipient_username text,
  p_text text,
  p_media_url text default null,
  p_media_type text default null,
  p_media_name text default null,
  p_media_size bigint default null
)
returns table(id bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient public.users;
  v_sender_table text;
  v_recipient_table text;
  v_id bigint;
  v_created timestamptz;
begin
  select * into v_recipient
    from public.users
    where username = lower(p_recipient_username)
    limit 1;

  if v_recipient.id is null then
    raise exception 'Recipient not found: %', p_recipient_username;
  end if;

  v_sender_table := 'user_chat_' || replace(p_sender_id::text, '-', '_');
  v_recipient_table := 'user_chat_' || replace(v_recipient.id::text, '-', '_');

  -- Insert into sender's table
  execute format(
    'insert into public.%I (sender_id, recipient_id, text, media_url, media_type, media_name, media_size)
     values (%L::uuid, %L::uuid, %L, %L, %L, %L, %L)
     returning id, created_at',
    v_sender_table, p_sender_id::text, v_recipient.id::text, p_text,
    p_media_url, p_media_type, p_media_name, p_media_size
  )
  into v_id, v_created;

  -- Mirror into recipient's table
  execute format(
    'insert into public.%I (sender_id, recipient_id, text, media_url, media_type, media_name, media_size, read)
     values (%L::uuid, %L::uuid, %L, %L, %L, %L, %L, false)',
    v_recipient_table, p_sender_id::text, v_recipient.id::text, p_text,
    p_media_url, p_media_type, p_media_name, p_media_size
  );

  return query select v_id, v_created;
end;
$$;

grant execute on function public.send_message(uuid, text, text, text, text, text, bigint)
  to anon, authenticated, service_role;

-- 8) RPC: mark_read(user_id, other_username)
-- =====================================================
-- Called by the recipient when they open a conversation.
-- Marks all messages from the other user as read in the
-- current user's per-user chat table.
-- =====================================================
create or replace function public.mark_read(
  p_user_id uuid,
  p_other_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other public.users;
  v_table text;
  v_sender_table text;
begin
  select * into v_other
    from public.users
    where username = lower(p_other_username)
    limit 1;
  if v_other.id is null then
    return;
  end if;

  v_table := 'user_chat_' || replace(p_user_id::text, '-', '_');
  v_sender_table := 'user_chat_' || replace(v_other.id::text, '-', '_');

  -- Mark messages FROM the other user as read in OUR table
  execute format(
    'update public.%I
     set read = true
     where sender_id = %L::uuid
       and recipient_id = %L::uuid
       and read = false',
    v_table, v_other.id::text, p_user_id::text
  );

  -- Also mark the same messages as read in the SENDER's table copy,
  -- so the sender sees the read receipt in real-time.
  execute format(
    'update public.%I
     set read = true
     where sender_id = %L::uuid
       and recipient_id = %L::uuid
       and read = false',
    v_sender_table, v_other.id::text, p_user_id::text
  );
end;
$$;

grant execute on function public.mark_read(uuid, text)
  to anon, authenticated, service_role;

-- 9) RPC: change_password(user_id, current_password, new_password)
-- =====================================================
-- Verifies the current password matches what's in the DB, then
-- updates password_hash to the new password. Returns true on
-- success, raises an exception on wrong current password.
-- =====================================================
create or replace function public.change_password(
  p_user_id uuid,
  p_current_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stored text;
begin
  -- Look up the stored password
  select password_hash into v_stored
  from public.users
  where id = p_user_id;

  if v_stored is null then
    raise exception 'User not found';
  end if;

  -- Verify the current password matches
  if v_stored != p_current_password then
    raise exception 'Current password is incorrect';
  end if;

  -- Enforce minimum length
  if length(p_new_password) < 6 then
    raise exception 'New password must be at least 6 characters';
  end if;

  -- Update the password
  update public.users
  set password_hash = p_new_password
  where id = p_user_id;

  return true;
end;
$$;

grant execute on function public.change_password(uuid, text, text)
  to anon, authenticated, service_role;

-- 10) RPC: get_conversation(user_id, other_username)
-- =====================================================
create or replace function public.get_conversation(
  p_user_id uuid,
  p_other_username text
)
returns table(
  id bigint,
  sender_id uuid,
  recipient_id uuid,
  text text,
  media_url text,
  media_type text,
  media_name text,
  media_size bigint,
  read boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other public.users;
  v_table text;
begin
  select * into v_other
    from public.users
    where username = lower(p_other_username)
    limit 1;
  if v_other.id is null then
    return;
  end if;

  v_table := 'user_chat_' || replace(p_user_id::text, '-', '_');

  return query execute format(
    'select id, sender_id, recipient_id, text, media_url, media_type, media_name, media_size, read, created_at
     from public.%I
     where sender_id = %L::uuid or recipient_id = %L::uuid
     order by created_at asc',
    v_table, v_other.id::text, v_other.id::text
  );
end;
$$;

grant execute on function public.get_conversation(uuid, text)
  to anon, authenticated, service_role;

-- 10) STORAGE: avatars bucket
-- =====================================================
-- Used to store user profile images. Each user can upload their
-- own avatar. Public read so anyone can see profile pictures.
-- =====================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Allow anyone to read avatars
drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

-- Allow uploads to the avatars bucket (anyone can upload —
-- in a real app you'd restrict to the authenticated user)
drop policy if exists "Anyone can upload avatars" on storage.objects;
create policy "Anyone can upload avatars" on storage.objects
  for insert with check (bucket_id = 'avatars');

drop policy if exists "Anyone can update avatars" on storage.objects;
create policy "Anyone can update avatars" on storage.objects
  for update using (bucket_id = 'avatars');

drop policy if exists "Anyone can delete avatars" on storage.objects;
create policy "Anyone can delete avatars" on storage.objects
  for delete using (bucket_id = 'avatars');

-- =====================================================
-- DONE!
-- =====================================================
-- After running this script:
-- 1. Restart the dev server (the app reads from .env.local)
-- 2. Open the app — splash → login page
-- 3. Sign in with your registered username
-- 4. Go to Settings → Profile and change your name/photo
-- =====================================================
