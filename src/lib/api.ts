/**
 * ICONNECT data layer
 * ====================
 * Wraps all Supabase database operations. The app talks directly to
 * your Supabase project — no in-memory mock or sample data.
 *
 * Setup:
 *  1. Create a project at https://supabase.com
 *  2. Run the SQL in `src/lib/schema.sql` in the Supabase SQL editor
 *  3. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in `.env.local`
 */

import { supabase } from "./supabase";
import type { DbMessage, DbRole, DbTransaction, DbUser } from "./supabase";

// ----- UI shapes (used throughout the app) -----
export type UiUser = {
  id: number | string;
  name: string;
  username: string;
  password: string;
  phone: string;
  role: DbRole;
  active: boolean;
  lastActive: string;
  joined: string;
  avatar: string;
};

export type UiMessage = {
  id: number;
  text: string;
  from: "me" | "them";
  time: string;
  read?: boolean;
  media?: {
    url: string;
    type: "image" | "file";
    name?: string;
    size?: number;
  };
};

export type UiTransaction = {
  id: number;
  type: "incoming" | "expense";
  category?: "account" | "expense";
  from?: string;
  accountNumber?: string;
  fromBank?: string;
  senderName?: string;
  expenseReason?: string;
  amount: number;
  notes?: string;
  date: string;
  time: string;
};

// ----- Mappers: DB rows -> UI shapes -----
function dbUserToUi(u: DbUser): UiUser {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    password: u.password_hash,
    phone: u.phone,
    role: u.role,
    active: u.active,
    lastActive: u.last_active,
    joined: u.joined_at,
    avatar: u.avatar,
  };
}

function dbTxToUi(t: DbTransaction): UiTransaction {
  return {
    id: t.id,
    type: t.type,
    category: t.category ?? undefined,
    from: t.from_field ?? undefined,
    accountNumber: t.account_number ?? undefined,
    fromBank: t.from_bank ?? undefined,
    senderName: t.sender_name ?? undefined,
    expenseReason: t.expense_reason ?? undefined,
    amount: t.amount,
    notes: t.notes ?? undefined,
    date: new Date(t.created_at).toLocaleDateString(),
    time: new Date(t.created_at).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

// ----- Public API -----
export const api = {
  // ----- Users -----
  async listUsers(): Promise<UiUser[]> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data as DbUser[]).map(dbUserToUi);
  },

  async getUserByUsername(username: string): Promise<UiUser | null> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data ? dbUserToUi(data as DbUser) : null;
  },

  async createUser(input: {
    name: string;
    username: string;
    phone: string;
    role: DbRole;
    password: string;
  }): Promise<UiUser> {
    // Call the RPC defined in schema.sql — the trigger will
    // automatically create a per-user chat table.
    const { data, error } = await supabase.rpc("create_user", {
      p_name: input.name,
      p_username: input.username,
      p_phone: input.phone,
      p_role: input.role,
      p_password: input.password,
    });
    if (error) {
      console.error("Supabase create_user RPC error:", {
        code: (error as any).code,
        message: (error as any).message,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      throw error;
    }
    return dbUserToUi(data as DbUser);
  },

  async updateUserName(userId: number | string, name: string): Promise<void> {
    const { error } = await supabase
      .from("users")
      .update({ name })
      .eq("id", userId as string);
    if (error) throw error;
  },

  // ----- Transactions -----
  async listTransactions(userId: number | string): Promise<UiTransaction[]> {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId as string)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as DbTransaction[]).map(dbTxToUi);
  },

  async createTransaction(
    userId: number | string,
    input: Omit<UiTransaction, "id" | "date" | "time">
  ): Promise<UiTransaction> {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: userId as string,
        type: input.type,
        category: input.category ?? null,
        from_field: input.from ?? null,
        account_number: input.accountNumber ?? null,
        from_bank: input.fromBank ?? null,
        sender_name: input.senderName ?? null,
        expense_reason: input.expenseReason ?? null,
        amount: input.amount,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return dbTxToUi(data as DbTransaction);
  },

  // ----- Messages -----
  async listConversations(userId: number | string): Promise<UiUser[]> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .neq("id", userId as string)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data as DbUser[]).map(dbUserToUi);
  },

  async getMessages(
    userId: number | string,
    otherUsername: string
  ): Promise<UiMessage[]> {
    const { data, error } = await supabase.rpc("get_conversation", {
      p_user_id: userId as string,
      p_other_username: otherUsername,
    });
    if (error) throw error;
    return (data as DbMessage[]).map((m) => ({
      id: Number(m.id),
      text: m.text,
      from: m.sender_id === userId ? "me" : "them",
      time: new Date(m.created_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
      read: Boolean((m as any).read),
      media: m.media_url
        ? {
            url: m.media_url,
            type: (m.media_type as "image" | "file") || "file",
            name: m.media_name ?? undefined,
            size: m.media_size ?? undefined,
          }
        : undefined,
    }));
  },

  async sendMessage(
    userId: number | string,
    recipientUsername: string,
    payload: {
      text: string;
      mediaUrl?: string;
      mediaType?: "image" | "file";
      mediaName?: string;
      mediaSize?: number;
    }
  ): Promise<UiMessage> {
    const { data, error } = await supabase.rpc("send_message", {
      p_sender_id: userId as string,
      p_recipient_username: recipientUsername,
      p_text: payload.text,
      p_media_url: payload.mediaUrl ?? null,
      p_media_type: payload.mediaType ?? null,
      p_media_name: payload.mediaName ?? null,
      p_media_size: payload.mediaSize ?? null,
    });
    if (error) throw error;
    const arr = (data as DbMessage[]) || [];
    const row = arr[0];
    return {
      id: Number(row.id),
      text: row.text,
      from: "me",
      time: new Date(row.created_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
      media: payload.mediaUrl
        ? {
            url: payload.mediaUrl,
            type: (payload.mediaType as "image" | "file") || "file",
            name: payload.mediaName,
            size: payload.mediaSize,
          }
        : undefined,
    };
  },

  /**
   * Subscribe to real-time messages on the current user's chat table.
   * Returns an unsubscribe function.
   */
  subscribeMessages(
    userId: number | string,
    otherUsername: string,
    onNew: (m: UiMessage) => void
  ): () => void {
    const table = `user_chat_${String(userId).replace(/-/g, "_")}`;
    const channel = supabase
      .channel(`chat:${userId}:${otherUsername}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table },
        (payload: any) => {
          const row = payload.new as DbMessage;
          onNew({
            id: Number(row.id),
            text: row.text,
            from: row.sender_id === userId ? "me" : "them",
            time: new Date(row.created_at).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            }),
            media: row.media_url
              ? {
                  url: row.media_url,
                  type: (row.media_type as "image" | "file") || "file",
                  name: row.media_name ?? undefined,
                  size: row.media_size ?? undefined,
                }
              : undefined,
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Mark all messages from `otherUsername` as read in the current
   * user's per-user chat table. Called by the recipient when they
   * open a conversation.
   */
  async markRead(
    userId: number | string,
    otherUsername: string
  ): Promise<void> {
    const { error } = await supabase.rpc("mark_read", {
      p_user_id: userId as string,
      p_other_username: otherUsername,
    });
    if (error) {
      console.warn("mark_read error:", error);
    }
  },

  /**
   * Mark the current user as active and update last_active to the
   * current time. Called on login and on a heartbeat interval.
   */
  async setUserActive(userId: number | string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({ active: true, last_active: now })
      .eq("id", userId as string);
    if (error) {
      console.warn("setUserActive error:", error);
    }
  },

  /**
   * Upload a profile image to Supabase Storage and update the
   * user's `avatar` column with the public URL. Returns the
   * public URL on success.
   */
  async uploadAvatar(
    userId: number | string,
    dataUrl: string,
    fileName: string = "avatar"
  ): Promise<string> {
    // Convert data URL to Blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    // Build a unique path: <userId>/<timestamp>-<fileName>.jpg
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${userId}/${Date.now()}-${fileName}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, {
        contentType: blob.type,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Save the public URL to the user's row
    const { error: updateError } = await supabase
      .from("users")
      .update({ avatar: publicUrl })
      .eq("id", userId as string);
    if (updateError) throw updateError;

    return publicUrl;
  },

  /**
   * Change the current user's password. The RPC verifies the
   * `current_password` against the stored `password_hash` and
   * raises an exception if they don't match.
   */
  async changePassword(
    userId: number | string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const { error } = await supabase.rpc("change_password", {
      p_user_id: userId as string,
      p_current_password: currentPassword,
      p_new_password: newPassword,
    });
    if (error) {
      // Re-throw with a friendly message
      const msg = error.message || "";
      if (msg.toLowerCase().includes("incorrect")) {
        throw new Error("Current password is incorrect");
      } else if (msg.toLowerCase().includes("at least 6")) {
        throw new Error("New password must be at least 6 characters");
      } else if (msg) {
        throw new Error(msg);
      } else {
        throw new Error("Failed to change password");
      }
    }
  },

  /**
   * Mark the current user as offline. Called on sign out or
   * when the app is closed.
   */
  async setUserOffline(userId: number | string): Promise<void> {
    const { error } = await supabase
      .from("users")
      .update({ active: false })
      .eq("id", userId as string);
    if (error) {
      console.warn("setUserOffline error:", error);
    }
  },

  /**
   * Get the read status of the most recent message SENT by
   * `userId` to `otherUsername`. Used by the sender to see
   * whether their message was read.
   */
  async getReadStatus(
    userId: number | string,
    otherUsername: string
  ): Promise<{ read: boolean } | null> {
    const { data, error } = await supabase.rpc("get_read_status", {
      p_user_id: userId as string,
      p_other_username: otherUsername,
    });
    if (error || !data || data.length === 0) return null;
    const row = (data as any[])[0];
    return { read: Boolean(row.read) };
  },

  /**
   * Subscribe to read-receipt updates on the current user's chat
   * table. When the recipient updates the `read` flag, the sender
   * sees the tick turn blue.
   */
  subscribeReadReceipts(
    userId: number | string,
    otherUsername: string,
    onChange: (read: boolean, messageId: number | string) => void
  ): () => void {
    // The sender's per-user chat table now gets `read = true` updates
    // (from the mark_read RPC). Subscribe to that table.
    const table = `user_chat_${String(userId).replace(/-/g, "_")}`;
    const channel = supabase
      .channel(`read:${userId}:${otherUsername}`)
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table },
        (payload: any) => {
          const row = payload.new as any;
          // Only notify for messages we sent (sender_id = us)
          if (row.sender_id === userId) {
            onChange(Boolean(row.read), row.id);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};
