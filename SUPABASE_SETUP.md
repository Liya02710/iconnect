# ICONNECT — Supabase Integration

This app is wired to [Supabase](https://supabase.com) as its database. Follow these steps to connect your own Supabase project.

## 1. Create a Supabase project

Go to [https://supabase.com](https://supabase.com), sign in, and create a new project.

## 2. Run the database schema

1. In your Supabase dashboard, open **SQL Editor** (left sidebar).
2. Click **New query**.
3. Copy the entire contents of `src/lib/schema.sql` and paste it into the editor.
4. Click **Run** (or press `Ctrl/Cmd + Enter`).

This creates:
- `public.users` — the global user table
- `public.transactions` — money in/out records
- `public.chat_tables` — registry of per-user chat tables
- A trigger that **automatically creates a dedicated chat table** for each new user
- RPCs (`create_user`, `send_message`, `get_conversation`) the app uses

## 3. Get your API keys

1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL**.
3. Copy the **anon public** key.

## 4. Configure the app

Create a file called `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## 5. Restart the dev server

```bash
npm run dev
```

The app will now use the real Supabase database.

## How it works

### Tables

- **users** — one row per account. Each new user is created via the `create_user` RPC.
- **transactions** — one row per money in/out record.
- **user_chat_<uuid>** — **a dedicated chat table for each user**, created automatically by the trigger. Each user has their own table, and messages are mirrored to both sender and recipient tables so each user can query their own conversations efficiently.

### Triggers

When `create_user` is called, an `AFTER INSERT` trigger runs `handle_new_user()`, which:
1. Inserts a row in `chat_tables` registry
2. Creates a new `user_chat_<uuid>` table (inheriting the same schema)
3. Enables Row-Level Security (RLS) and adds policies
4. Adds the new table to the `supabase_realtime` publication so messages can stream in real-time

### RPCs (Remote Procedure Calls)

- `create_user(name, username, phone, role, password)` — Admin creates a new account.
- `send_message(sender_id, recipient_username, text, media_*)` — Send a message (writes to both sender and recipient tables).
- `get_conversation(user_id, other_username)` — Fetch all messages between two users.

### Real-time subscriptions

The app subscribes to `INSERT` events on the current user's `user_chat_<uuid>` table. When a new message arrives, the chat UI updates instantly without a refresh.

## Without Supabase

If no `.env.local` is provided, the app uses an **in-memory mock** so you can still develop and demo without a Supabase project. All API calls fall back to local data automatically.

## Files

- `src/lib/supabase.ts` — Client setup + type definitions
- `src/lib/schema.sql` — Full database schema (run in Supabase SQL Editor)
- `src/lib/api.ts` — Service layer (all DB operations)
- `.env.example` — Template for environment variables
