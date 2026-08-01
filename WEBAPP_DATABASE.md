# 🌐 Web App → Database Connection

ICONNECT is a **database-only** web app — it has **no local backend, no in-memory mock, and no offline mode**. Every screen, every list, every record, every message comes from your live Supabase project.

---

## 📡 Connection Flow

```
User browser  ──HTTPS──▶  Cloudflare Pages (static assets)
                          │
                          ▼
                    VITE_SUPABASE_URL (env var baked in at build)
                          │
                          ▼
                    https://dqanfgqpciuhwbmvmchl.supabase.co
                          │
                          ▼
                    PostgreSQL + Realtime + Storage + Auth
```

The app loads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time (Vite inlines them into the JS bundle). All API calls go directly to your Supabase project.

---

## ✅ Confirmed: No Local Backend

| Component | Backend |
|-----------|---------|
| User list | Supabase `public.users` table |
| Per-user chat tables | Auto-created via trigger `handle_new_user` |
| Messages | Per-user `user_chat_<uuid>` tables |
| Transactions | `public.transactions` table |
| Profile pictures | `avatars` storage bucket |
| Real-time updates | Supabase `postgres_changes` |

The code is in `src/lib/api.ts` — every method makes a direct call to Supabase. There are **zero** `mock*`, `memory*`, `local*`, or `fallback*` data sources in the codebase.

---

## 🛠️ Configuring the Connection

### Step 1: Set environment variables

For **local dev** — create a `.env.local` file:

```env
VITE_SUPABASE_URL=https://dqanfgqpciuhwbmvmchl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxYW5mZ3FwY2l1aHdibXZtY2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0ODIyMDcsImV4cCI6MjEwMTA1ODIwN30.YXGt4JWQpPwIlBCH-Eh7Vn-kr-dYDWQuAYy6j-vSrB4
```

For **Cloudflare Pages** — set in the dashboard:

1. Pages → your project → **Settings** → **Environment variables**
2. Add:
   - `VITE_SUPABASE_URL` = `https://dqanfgqpciuhwbmvmchl.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (your anon key)
3. Trigger a new deploy

### Step 2: Run the database schema

In Supabase → **SQL Editor** → paste and run `src/lib/schema.sql`. This creates:
- `public.users` table
- `public.transactions` table
- `public.chat_tables` registry
- `handle_new_user()` trigger (auto-creates per-user chat tables)
- RPCs: `create_user`, `send_message`, `get_conversation`, `mark_read`, `change_password`
- Storage bucket: `avatars`
- RLS policies (permissive for the demo)

### Step 3: Configure CORS

In Supabase → **Settings** → **API** → **CORS**:

Add the origins you'll be using:

```
http://localhost:5173          # Local dev (Vite default)
https://*.pages.dev             # Cloudflare Pages preview
https://iconnect.app            # Custom domain
```

Or use `*` for development (less secure but OK for testing).

---

## 🔍 Verifying the Connection

After deploying, open the browser DevTools (F12) → **Network** tab. You should see requests to:

- `https://dqanfgqpciuhwbmvmchl.supabase.co/rest/v1/users` — fetching the user list
- `https://dqanfgqpciuhwbmvmchl.supabase.co/rest/v1/rpc/create_user` — creating users
- `https://dqanfgqpciuhwbmvmchl.supabase.co/storage/v1/object/avatars/...` — uploading avatars
- `wss://dqanfgqpciuhwbmvmchl.supabase.co/realtime/v1/websocket` — real-time updates

If you see any of these requests failing (CORS, 401, 403), check the **CORS** settings in Supabase.

---

## 🐛 Common Issues

### "Network Error" or "Failed to fetch" on the deployed site
→ **CORS not configured.** Add the deployed origin to Supabase → Settings → API → CORS.

### "Invalid username or password" when the user exists in DB
→ Open DevTools → Console. If you see a CORS error, the request never reached Supabase. Fix CORS.

### Page shows "Configuration required" screen
→ Env vars are missing. Set them in Cloudflare Pages environment variables and redeploy.

### Login works locally but not on the deployed site
→ Most likely **env vars not set on the deployed site**, or the anon key is invalid.

---

## 🔐 Security Notes

- The **anon key** is safe to expose in the client bundle — it's designed for public use with RLS as the security layer
- The **service_role key** (NOT used in this app) would bypass RLS — never expose it
- All sensitive operations (creating users, sending messages) are done via SECURITY DEFINER RPCs which run with elevated privileges inside Postgres

The current schema is permissive for the demo. In production, you'd want to:
- Restrict `create_user` to admins only
- Restrict chat reads to participants only
- Add proper authentication via `supabase.auth.signInWithPassword()`

---

## 📊 Database Connection Status

The app is hard-wired to:
- **URL**: `https://dqanfgqpciuhwbmvmchl.supabase.co`
- **Region**: Supabase managed
- **Tables**: `users`, `transactions`, `chat_tables`, `user_chat_<uuid>` (auto-created)
- **Storage**: `avatars` bucket

There is no fallback to a local database, no offline mode, and no sample data. If the Supabase project is unreachable, the app shows a "Configuration required" error screen.
