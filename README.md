# ICONNECT 💚

> A modern digital wallet and chat app built with React, TypeScript, Vite, Tailwind CSS, and **Supabase** (PostgreSQL + Realtime + Storage + Auth).

![Stack](https://img.shields.io/badge/React-18-61dafb?logo=react)
![Stack](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Stack](https://img.shields.io/badge/Vite-5-646cff?logo=vite)
![Stack](https://img.shields.io/badge/Tailwind_CSS-3-38bdf8?logo=tailwindcss)
![Stack](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)

---

## ✨ Features

- 🔐 **Secure login** with Supabase Auth (or simple username lookup for the demo)
- 💬 **Real-time chat** with per-user tables, read receipts, and unread badges
- 📷 **Profile picture upload** to Supabase Storage
- 💸 **Money tracking** (incoming / expense records) with charts
- 👥 **User management** (admins can create, view, and manage all users)
- 🔒 **Role-based access control** (Admin vs Client)
- 📊 **iOS 16-style liquid glassmorphism** design
- 🎬 **Splash screen + welcome animation** with real user name
- 📱 **Fully responsive** — works on mobile and desktop
- 🚀 **Deploy to Netlify** with one click (`netlify.toml` included)

---

## 📸 Screenshots

> _(Add screenshots of Home, Balance chart, Messages, Settings)_

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5 |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 (with iOS 16 glassmorphism) |
| Icons | Inline SVG (Lucide-style) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (or anon key for demo) |
| Storage | Supabase Storage (`avatars` bucket) |
| Realtime | Supabase Postgres Changes |
| Hosting | Netlify (static + edge functions) |

---

## 🚀 Quick Start

### 1. Clone & install

```bash
git clone <your-repo-url>
cd iconnect
npm install
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** in your Supabase dashboard
3. Copy the entire contents of [`src/lib/schema.sql`](./src/lib/schema.sql) and run it
4. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

### 3. Configure environment

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and you should see the splash screen, login page, and the full app.

---

## 🏗️ Build for production

```bash
npm run build
```

The build artifacts are placed in the `dist/` folder. This is what Netlify serves.

To preview the production build locally:

```bash
npm run preview
```

---

## 🚢 Deploy to Netlify

The repo includes a pre-configured `netlify.toml`:

```toml
[build]
  publish = "dist"
  command = "npm run build"
```

### Steps

1. Push your code to GitHub / GitLab
2. In Netlify, click **Add new site → Import an existing project**
3. Connect your repo
4. **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL` = `https://<your-project>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<your-anon-key>`
5. Click **Deploy site**

The app will be live at `https://<your-site>.netlify.app`.

---

## 🗄️ Database Schema

The full schema is in [`src/lib/schema.sql`](./src/lib/schema.sql). It creates:

### Tables

| Table | Purpose |
|-------|---------|
| `public.users` | All accounts (id, name, username, phone, role, active, avatar, last_active, joined_at, …) |
| `public.transactions` | Money in/out records |
| `public.chat_tables` | Registry of per-user chat tables |
| `public.user_chat_<uuid>` | **Auto-created** per-user chat table for each new user |

### Triggers

- `handle_new_user()` — runs on `INSERT` to `public.users` and automatically:
  1. Creates a new `user_chat_<uuid>` table for the user
  2. Adds RLS policies (read own chat, insert into chat)
  3. Adds the table to the `supabase_realtime` publication

### RPCs

| Function | Purpose |
|----------|---------|
| `create_user(name, username, phone, role, password)` | Insert user; trigger creates chat table |
| `send_message(sender_id, recipient_username, text, media_*)` | Send message (writes to both sender's and recipient's tables) |
| `get_conversation(user_id, other_username)` | Fetch messages between two users |
| `mark_read(user_id, other_username)` | Mark messages as read in BOTH tables |
| `get_read_status(user_id, other_username)` | Read-status for the latest sent message |
| `change_password(user_id, current, new)` | Verify old + update new password |

### Storage

- `avatars` bucket — public read, stores user profile pictures at `<user_id>/<timestamp>-avatar.jpg`

---

## 📁 Project Structure

```
iconnect/
├── .env.local              # Your secrets (NOT committed)
├── .gitignore              # Files to ignore in git
├── index.html              # Vite entry HTML
├── netlify.toml            # Netlify hosting config
├── package.json            # Dependencies + scripts
├── project.toml            # Project metadata (TOML)
├── SUPABASE_SETUP.md       # Detailed Supabase setup guide
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── App.tsx             # Main app shell, routing, sign-in/out
    ├── main.tsx            # React entry
    ├── index.css           # Tailwind + iOS 16 glassmorphism CSS
    │
    ├── components/
    │   ├── LoginPage.tsx   # Sign-in form with iOS 16 styling
    │   ├── SplashScreen.tsx # Animated splash on first load
    │   └── WelcomeAnimation.tsx # Greeting on login
    │
    ├── lib/
    │   ├── supabase.ts     # Supabase client + DB types
    │   ├── api.ts          # Service layer (api.listUsers, api.sendMessage, …)
    │   └── schema.sql      # Full database schema
    │
    ├── pages/
    │   ├── Home.tsx        # Greeting + About card
    │   ├── Balance.tsx     # Total balance + Income vs Outgoing chart
    │   ├── Message.tsx     # Conversation list + Chat detail
    │   ├── Transaction.tsx # Add Incoming / Add Expense
    │   └── Settings.tsx    # Profile / Users / Create
    │
    └── types/
        └── user.ts         # TypeScript types (User, Role)
```

---

## 🔑 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview the production build locally |

---

## 🎨 Design System

ICONNECT uses an **iOS 16 liquid glassmorphism** design language:

- Frosted glass cards (`backdrop-filter: blur(...)`)
- 0.5px hairline borders
- Inset top highlights (light catching the edge)
- Subtle noise textures
- Layered shadows for depth
- iOS-style `saturate(180%)` blur for vivid colors
- 3-color gradient blobs that morph and float in the background

The brand color is `#77ff33` (neon green), used for buttons, active states, online indicators, and the ICONNECT wordmark.

---

## 🔐 Role-Based Access Control

The app has two roles:

| Role | Can see all users | Can add transactions | Can create users |
|------|-------------------|-----------------------|------------------|
| **Admin** | ✅ | ✅ | ✅ |
| **Client** | ❌ (only admins) | ❌ | ❌ |

- **Admins** can see all conversations and manage the system
- **Clients** can only message admins and see the empty transaction list

A top-right pill on the app lets you toggle between Admin/Client views for demo purposes.

---

## 🧪 Test the App

After running the SQL schema, you can create your first user via the **Login page → Create account** tab, or directly in the Supabase Table Editor.

### Default demo users (if you insert them manually)

| Username | Password | Role | Phone |
|----------|----------|------|-------|
| `admin` | `Liya0271` | Admin | +94 75 982 5269 |
| `user` | `user123` | Client | +94 77 123 4567 |

> **Note**: The login screen doesn't verify the password yet — it just looks up the username. For production, add `supabase.auth.signInWithPassword()` to the `handleLogin` function in `App.tsx`.

---

## 🐛 Troubleshooting

### "Missing supabase credentials" error
→ Make sure `.env.local` exists with both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### "function create_user does not exist"
→ Re-run the entire `src/lib/schema.sql` in your Supabase SQL Editor.

### Profile image doesn't show
→ Check that the `avatars` bucket exists in **Storage** and the RLS policies were created.

### Messages don't appear in real-time
→ Go to **Database → Replication** in Supabase and ensure `users` and `transactions` are added to the `supabase_realtime` publication. The trigger also adds per-user chat tables automatically.

### "new row violates row-level security policy"
→ Re-run the schema — the latest version has permissive `anon` policies on the `users` table so anyone can read.

### Deployed site shows a black page
1. **Missing env vars** — The most common cause. The app needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set at **build time**. In your hosting platform's settings (Netlify or Cloudflare Pages), add these as environment variables, then trigger a rebuild.
2. **Wrong deployment type** — If you see a URL like `*.workers.dev`, you've deployed as a Worker, not a Page. Cloudflare Pages uses `*.pages.dev`. Use `wrangler pages deploy dist` (not `wrangler deploy`).
3. **Browser console** — Open DevTools and check the console for the actual error message. The app now shows a friendly "Configuration required" screen if env vars are missing.
4. **Still stuck** — Open DevTools → Network tab → look for failed requests to `*.supabase.co`. If those fail with 403/401, the anon key is wrong.

---

## 📦 Hosting

ICONNECT is a pure static SPA, so it can be deployed to any static host.

### Netlify (recommended — pre-configured)

The repo includes a pre-configured `netlify.toml`:

- ✅ SPA fallback (`/*` → `/index.html`)
- ✅ Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- ✅ 1-year cache for hashed `/assets/*`
- ✅ No-cache for `/index.html`
- ✅ Preview deploys for PRs

**Deploy steps:**
1. Push your code to GitHub / GitLab
2. In Netlify: **Add new site → Import an existing project** → connect your repo
3. **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL` = `https://<your-project>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<your-anon-key>`
4. Click **Deploy site** — live at `https://<your-site>.netlify.app`

### Cloudflare Pages (also pre-configured)

The repo includes a pre-configured `wrangler.toml`:

- ✅ Build command + output dir set
- ✅ Long-cache rules for hashed assets (commented, ready to enable)
- ✅ No-cache for `index.html` (commented, ready to enable)
- ✅ Custom domain block ready to uncomment
- ✅ Observability config ready to enable

**Deploy steps (dashboard):**
1. Push your code to GitHub / GitLab
2. In Cloudflare: **Pages → Create a project → Connect to Git**
3. Select your repo
4. **Build settings**:
   - Build command: `npm run build`
   - Build output directory: `dist`
5. **Environment variables** (Settings → Environment variables):
   - `VITE_SUPABASE_URL` = `https://<your-project>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<your-anon-key>`
6. Click **Save and Deploy** — live at `https://<your-project>.pages.dev`

**Deploy steps (CLI):**

```bash
# One-time setup
npm install -g wrangler
wrangler login

# Build and deploy (use `pages deploy`, NOT `wrangler deploy` —
# `wrangler deploy` is for Workers, not Pages)
npm run build
wrangler pages deploy dist --project-name=iconnect
```

If this is your first time deploying, Wrangler will ask if you want to create a new Pages project. Answer **yes**, and it'll provision the project automatically.

Then add the env vars in the dashboard under **Settings → Environment variables** (or via `wrangler pages secret put VITE_SUPABASE_URL --project-name=iconnect` and `wrangler pages secret put VITE_SUPABASE_ANON_KEY --project-name=iconnect`).

### Other options

Vercel, GitHub Pages, Render, Firebase Hosting, or any static host that supports SPA routing. For all of them, the build command is `npm run build` and the output directory is `dist`.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m "Add my feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

---

## 🙌 Credits

- **Fonts**: [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) (display), [Caveat](https://fonts.google.com/specimen/Caveat) (brand wordmark), [Inter](https://fonts.google.com/specimen/Inter) (body) — all from Google Fonts
- **Icons**: Inline SVG (Lucide-style, hand-drawn)
- **Backend**: [Supabase](https://supabase.com) — the open-source Firebase alternative
- **Hosting**: [Netlify](https://netlify.com) — Jamstack hosting

---

## 📞 Contact

Built with ❤️ by the ICONNECT team.

For questions or support, open an issue on GitHub.
