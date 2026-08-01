import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// =====================================================
// Supabase client configuration
// =====================================================
// Reads credentials from environment variables:
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_ANON_KEY
// Set them in `.env.local` at the project root.
// =====================================================

const env: Record<string, string | undefined> =
  ((import.meta as any).env as Record<string, string | undefined>) || {};

const SUPABASE_URL: string = env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY: string = env.VITE_SUPABASE_ANON_KEY || "";

const isConfigured = Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY);

if (!isConfigured && typeof window !== "undefined") {
  // Friendly error shown in the browser console so the developer
  // can see what's missing — but we don't hard-crash the app so
  // the UI can still render a friendly "configuration required"
  // message instead of a black page.
  console.error(
    "[ICONNECT] Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local (or in the Cloudflare Pages environment variables)."
  );
}

// Create a placeholder client when not configured so the app can
// still mount and show a friendly error screen. API calls will
// fail gracefully (caught by callers).
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  }
);

// =====================================================
// Database type definitions
// =====================================================

export type DbRole = "Admin" | "Client";

export type DbUser = {
  id: string; // uuid from auth.users
  name: string;
  username: string;
  phone: string;
  password_hash: string;
  role: DbRole;
  active: boolean;
  avatar: string;
  last_active: string;
  joined_at: string;
  created_at: string;
};

export type DbMessage = {
  id: number | string;
  sender_id: string; // sender
  recipient_id: string; // receiver (one-to-one chats)
  text: string;
  media_url: string | null;
  media_type: "image" | "file" | null;
  media_name: string | null;
  media_size: number | null;
  read: boolean;
  created_at: string;
};

export type DbTransaction = {
  id: number;
  user_id: string;
  type: "incoming" | "expense";
  category: "account" | "expense" | null;
  from_field: string | null;
  account_number: string | null;
  from_bank: string | null;
  sender_name: string | null;
  expense_reason: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
};
