import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  type UIEvent,
} from "react";
import { createPortal } from "react-dom";
import type { User } from "../types/user";
import { api, type UiMessage } from "../lib/api";
import { supabase } from "../lib/supabase";

type MediaItem = {
  url: string;
  type: "image" | "file";
  name?: string;
  size?: number;
};

type ChatMessage = UiMessage;

type Conversation = {
  // The user object this conversation belongs to
  user: User;
  // Local-only metadata for the list view
  lastText: string;
  lastTime: string;
  unread: boolean;
  online: boolean;
  // Lazy-loaded message list (keyed by user.id at the parent level)
  messages: ChatMessage[];
};

export default function Message({
  onChatOpenChange,
  users = [],
  currentUserId = 1,
}: {
  onChatOpenChange?: Dispatch<SetStateAction<boolean>>;
  users?: User[];
  currentUserId?: number | string;
}) {
  // The current logged-in user (look up in users by id)
  const me = users.find((u) => String(u.id) === String(currentUserId));
  const isAdmin = me?.role === "Admin";

  // Per-user chat state
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [pendingMedia, setPendingMedia] = useState<MediaItem | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);

  // Messages keyed by other user's id
  const [messagesByUser, setMessagesByUser] = useState<
    Record<string, ChatMessage[]>
  >({});
  // Number of unread (received but not yet opened) messages per user.
  // When the user opens a conversation, that user's unread count
  // resets to 0. When a new message arrives via real-time, it
  // increments.
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  // Track which conversations have been loaded from the DB
  const [loadedConvos, setLoadedConvos] = useState<Set<string>>(new Set());
  const [loadingConvo, setLoadingConvo] = useState(false);

  // Build the visible conversation list from the user list
  // Admins: see everyone
  // Clients: see only admins (so they can ask for help)
  const visibleUsers = users.filter((u) => {
    if (String(u.id) === String(currentUserId)) return false; // exclude self
    if (isAdmin) return true;
    return u.role === "Admin";
  });

  const conversations: Conversation[] = visibleUsers.map((u) => {
    const msgs = messagesByUser[String(u.id)] || [];
    const last = msgs[msgs.length - 1];
    return {
      user: u,
      lastText: last?.text || (last?.media ? "📎 Attachment" : "No messages yet"),
      lastTime: last?.time || "",
      unread: false, // could track this per-convo in future
      online: u.active,
      messages: msgs,
    };
  });

  // Scroll state
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [unreadBelow, setUnreadBelow] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);

  // Refs
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isAtBottom = useRef(true);

  // Notify parent about chat open state
  useEffect(() => {
    onChatOpenChange?.(openIndex !== null);
  }, [openIndex, onChatOpenChange]);

  // Load messages from the database when a conversation is opened
  useEffect(() => {
    if (openIndex === null) return;
    const other = conversations[openIndex]?.user;
    if (!other || !me) return;
    const key = String(other.id);
    if (loadedConvos.has(key)) return;

    setLoadingConvo(true);
    api
      .getMessages(me.id, other.username)
      .then((msgs) => {
        setMessagesByUser((prev) => ({ ...prev, [key]: msgs }));
        setLoadedConvos((prev) => new Set(prev).add(key));
        // When the user opens the conversation, clear their unread count
        setUnreadByUser((prev) => ({ ...prev, [key]: 0 }));
      })
      .catch((err) => console.error("Load messages error:", err))
      .finally(() => setLoadingConvo(false));
  }, [openIndex, conversations, me, loadedConvos]);

  // When the chat opens, mark messages from the other user as read
  // (and also mark this conversation as opened so the sender sees the tick).
  useEffect(() => {
    if (openIndex === null || !me) return;
    const other = conversations[openIndex]?.user;
    if (!other) return;
    api.markRead(me.id, other.username).catch((err) => {
      console.error("markRead error:", err);
    });
  }, [openIndex, conversations, me]);

  // Subscribe to real-time messages for the open conversation.
  // The subscription is bound to OUR per-user chat table, so it
  // fires when either the sender's `send_message` RPC inserts a new
  // row (because that RPC writes to BOTH sender's and recipient's
  // tables), or when the recipient receives a message and it's
  // mirrored into our table.
  //
  // We dedupe by message id — if the optimistic local message has
  // the same id we just received, we don't add it again.
  useEffect(() => {
    if (openIndex === null || !me) return;
    const other = conversations[openIndex]?.user;
    if (!other) return;
    const key = String(other.id);
    const unsubscribe = api.subscribeMessages(
      me.id,
      other.username,
      (msg) => {
        setMessagesByUser((prev) => {
          const existing = prev[key] || [];
          if (existing.some((m) => m.id === msg.id)) {
            return prev; // already have this message — dedupe
          }
          return { ...prev, [key]: [...existing, msg] };
        });
        // New message received from other user — mark as read
        if (msg.from === "them") {
          api.markRead(me.id, other.username).catch(() => {});
        }
      }
    );
    return () => unsubscribe();
  }, [openIndex, conversations, me]);

  // Global subscription on our chat table — listens for ANY new
  // message (from any user) and bumps the unread count for that
  // conversation. Also triggers a refetch of the user list so
  // `last_active` updates appear in real-time.
  useEffect(() => {
    if (!me) return;
    const table = `user_chat_${String(me.id).replace(/-/g, "_")}`;
    const channel = supabase
      .channel(`global-chat:${me.id}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table },
        (payload: any) => {
          const row = payload.new as any;
          const senderId = String(row.sender_id);
          // The other user's id is the sender (when the message
          // comes from them) OR the recipient (when the message
          // is from us and was mirrored into our own table)
          let otherKey: string | null = null;
          if (senderId !== String(me.id)) {
            // Message from someone else
            otherKey = senderId;
          } else {
            // Message from us (mirrored) — not visible to the
            // recipient, skip
            return;
          }
          if (!otherKey) return;
          // If this conversation is currently open, don't bump
          // the unread count
          const currentOther = conversations[openIndex ?? -1]?.user;
          if (currentOther && String(currentOther.id) === otherKey) {
            return;
          }
          setUnreadByUser((prev) => ({
            ...prev,
            [otherKey!]: (prev[otherKey!] || 0) + 1,
          }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, openIndex, conversations]);

  // Subscribe to read-receipt updates so the sender sees their
  // own messages get marked as "read" in real-time.
  useEffect(() => {
    if (openIndex === null || !me) return;
    const other = conversations[openIndex]?.user;
    if (!other) return;
    const key = String(other.id);
    const unsubscribe = api.subscribeReadReceipts(
      me.id,
      other.username,
      (read, messageId) => {
        // The recipient marked this specific message as read.
        // Update only that message in our local state.
        setMessagesByUser((prev) => {
          const list = prev[key] || [];
          const updated = list.map((m) =>
            String(m.id) === String(messageId) ? { ...m, read } : m
          );
          return { ...prev, [key]: updated };
        });
      }
    );
    return () => unsubscribe();
  }, [openIndex, conversations, me]);

  // Auto-scroll to bottom when opening a chat or new messages arrive
  useEffect(() => {
    if (openIndex !== null && scrollRef.current) {
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }, 100);
        });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [openIndex, messagesByUser, pendingMedia]);

  const open = (i: number) => {
    setOpenIndex(i);
  };

  const back = () => setOpenIndex(null);

  // Scroll handler
  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottom.current = distFromBottom < 60;
    setShowJumpToBottom(distFromBottom > 200);
  };

  // Touch handlers for pull-to-load history
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      const resisted = Math.min(delta * 0.4, 120);
      setPullDistance(resisted);
    }
  };

  const handleTouchEnd = () => {
    setPullDistance(0);
    touchStartY.current = null;
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
    setUnreadBelow(0);
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !pendingMedia) return;
    if (openIndex === null) return;
    const other = conversations[openIndex]?.user;
    if (!other || !me) return;

    const text = input.trim();
    const media = pendingMedia ?? undefined;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newMsg: ChatMessage = {
      id: tempId as any, // temporary, will be replaced with the real DB id
      text,
      from: "me",
      time: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
      media: media
        ? {
            url: media.url,
            type: media.type,
            name: media.name,
            size: media.size,
          }
        : undefined,
    };

    // Optimistic update
    const key = String(other.id);
    setMessagesByUser((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), newMsg],
    }));
    setInput("");
    setPendingMedia(null);
    if (!isAtBottom.current) {
      setUnreadBelow((n) => n + 1);
    }

    try {
      const sent = await api.sendMessage(me.id, other.username, {
        text,
        mediaUrl: media?.url,
        mediaType: media?.type,
        mediaName: media?.name,
        mediaSize: media?.size,
      });
      // Replace the temporary id with the real database id
      setMessagesByUser((prev) => {
        const list = prev[key] || [];
        return {
          ...prev,
          [key]: list.map((m) =>
            String(m.id) === tempId ? { ...m, id: sent.id, time: sent.time } : m
          ),
        };
      });
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  // File / image handlers
  const handleFile = (e: ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPendingMedia({
        url: ev.target?.result as string,
        type,
        name: file.name,
        size: file.size,
      });
      setShowAttachMenu(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCamera = () => {
    imageInputRef.current?.setAttribute("capture", "environment");
    imageInputRef.current?.click();
    setShowAttachMenu(false);
  };

  const handleGallery = () => {
    imageInputRef.current?.removeAttribute("capture");
    imageInputRef.current?.click();
    setShowAttachMenu(false);
  };

  const handleDocument = () => {
    fileInputRef.current?.click();
    setShowAttachMenu(false);
  };

  const removePending = () => setPendingMedia(null);

  // ===== Chat detail view =====
  if (openIndex !== null) {
    const conv = conversations[openIndex];
    if (!conv) return null;
    return createPortal(
      <div
        className="chat-shell"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100vw",
          height: "100dvh",
          zIndex: 40,
          background: "#000",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxSizing: "border-box",
          padding: 0,
          margin: 0,
        }}
      >
        {/* Chat header */}
        <div
          className="liquid-card flex shrink-0 items-center gap-3 rounded-2xl px-3 py-3"
          style={{ margin: "8px 12px" }}
        >
          <button
            onClick={back}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white/80 transition hover:bg-white/10"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div
            className="relative shrink-0"
            style={{ width: 40, height: 40 }}
          >
            <div
              className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white/10 text-sm font-semibold ring-1 ring-white/15"
              style={
                conv.user.avatar && conv.user.avatar.startsWith("http")
                  ? {
                      backgroundImage: `url(${conv.user.avatar})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : { color: "#fff" }
              }
            >
              {(!conv.user.avatar || !conv.user.avatar.startsWith("http")) &&
                conv.user.avatar}
            </div>
            {conv.user.active && (
              <span
                className="absolute h-3 w-3 rounded-full ring-2"
                style={{
                  background: "#77ff33",
                  bottom: -2,
                  right: -2,
                  boxShadow: "0 0 8px rgba(119,255,51,0.7)",
                  borderColor: "#000",
                }}
              />
            )}
          </div>
          <div
            className="min-w-0 flex-1"
            style={{ minWidth: 0 }}
          >
            <p
              className="truncate font-display text-lg font-semibold leading-tight"
              style={{ color: "#ffffff" }}
            >
              {conv.user.name}
            </p>
            <p
              className="mt-0.5 flex items-center gap-1.5 truncate text-[11px]"
              style={{ color: conv.user.active ? "#77ff33" : "rgba(255,255,255,0.5)" }}
            >
              {conv.user.active && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    background: "#77ff33",
                    boxShadow: "0 0 6px #77ff33",
                    flexShrink: 0,
                  }}
                />
              )}
              <span>
                {conv.user.active
                  ? `Online · @${conv.user.username}`
                  : `Offline · @${conv.user.username}`}
              </span>
            </p>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="chat-scroll liquid-card relative space-y-3 rounded-2xl"
          style={{
            flex: "1 1 0%",
            minHeight: 0,
            margin: "0 12px 8px 12px",
            padding: "12px 12px 16px 12px",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            position: "relative",
          }}
        >
          {/* Pull-to-load indicator */}
          {pullDistance > 0 && (
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-center"
              style={{ height: pullDistance }}
            >
              <div
                className="flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3 py-1 text-[11px] text-white/70 backdrop-blur"
                style={{
                  opacity: Math.min(pullDistance / 70, 1),
                  transform: `rotate(${pullDistance * 3}deg)`,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                  style={{ transform: `rotate(${pullDistance * 2}deg)` }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                Pull to load history
              </div>
            </div>
          )}

          {/* Date label */}
          <div
            className="flex justify-center"
            style={{ marginBottom: 8 }}
          >
            <span
              className="rounded-full px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70"
              style={{ background: "rgba(30,30,30,0.9)" }}
            >
              Today
            </span>
          </div>

          {/* Messages list */}
          {loadingConvo ? (
            <div className="flex items-center justify-center py-6">
              <div className="flex items-center gap-2 text-[11px] text-white/50">
                <span
                  className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white/80"
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
                Loading messages…
              </div>
            </div>
          ) : conv.messages.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-center">
              <div>
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-white/5">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 text-white/40"
                  >
                    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z" />
                    <path d="M8 11h.01M12 11h.01M16 11h.01" />
                  </svg>
                </div>
                <p className="text-sm text-white/60">No messages yet</p>
                <p className="mt-1 text-[11px] text-white/40">
                  Send a message to start the conversation
                </p>
              </div>
            </div>
          ) : (
            conv.messages.map((m) => (
              <MessageBubble key={m.id} message={m} onPreview={setPreviewMedia} />
            ))
          )}
        </div>

        {/* Jump to bottom button */}
        {(showJumpToBottom || unreadBelow > 0) && (
          <button
            onClick={scrollToBottom}
            className="absolute left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/80 px-3 py-1.5 text-[11px] text-white/80 shadow-lg backdrop-blur-2xl transition hover:bg-black"
            style={{ bottom: 80, animation: "slideUp 0.25s ease-out" }}
          >
            {unreadBelow > 0 ? (
              <span className="flex items-center gap-1.5">
                <span
                  className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-black"
                  style={{ background: "#77ff33" }}
                >
                  {unreadBelow}
                </span>
                new message{unreadBelow > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                Jump to latest
              </span>
            )}
          </button>
        )}

        {/* Pending media preview */}
        {pendingMedia && (
          <div style={{ margin: "0 12px" }}>
            <PendingMediaPreview
              media={pendingMedia}
              onRemove={removePending}
            />
          </div>
        )}

        {/* Attach menu */}
        {showAttachMenu && (
          <div style={{ margin: "0 12px" }}>
            <AttachMenu
              onCamera={handleCamera}
              onGallery={handleGallery}
              onDocument={handleDocument}
              onClose={() => setShowAttachMenu(false)}
            />
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e, "image")}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFile(e, "file")}
        />

        {/* Composer */}
        <form
          onSubmit={send}
          className="liquid-card flex items-center gap-2 rounded-2xl p-2"
          style={{ margin: "0 12px 8px 12px" }}
        >
          <button
            type="button"
            onClick={() => setShowAttachMenu((v) => !v)}
            className={`grid h-9 w-9 place-items-center rounded-xl text-white/80 transition ${
              showAttachMenu ? "bg-white/15" : "bg-white/5 hover:bg-white/10"
            }`}
            aria-label="Attach media"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              style={{
                transform: showAttachMenu ? "rotate(45deg)" : "rotate(0deg)",
                transition: "transform 0.3s ease",
              }}
            >
              <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49L13.21 2.3a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.49" />
            </svg>
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pendingMedia
                ? "Add a caption..."
                : "Type a message..."
            }
            className="flex-1 bg-transparent px-2 py-2 text-sm text-white placeholder-white/40 outline-none"
            style={{ color: "#fff" }}
          />
          <button
            type="submit"
            disabled={!input.trim() && !pendingMedia}
            className="grid h-9 w-9 place-items-center rounded-xl text-black transition disabled:opacity-40"
            style={{
              background:
                "linear-gradient(135deg, #77ff33 0%, #5cd91f 100%)",
            }}
            aria-label="Send"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
            </svg>
          </button>
        </form>

        {/* Fullscreen media preview */}
        {previewMedia && (
          <MediaLightbox
            media={previewMedia}
            onClose={() => setPreviewMedia(null)}
          />
        )}
      </div>,
      document.body
    );
  }

  // ===== Conversation list view =====
  const unreadCount = 0; // could be tracked per-convo
  const onlineCount = conversations.filter((c) => c.online).length;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Inbox</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Messages</h1>
        </div>
        <div className="flex items-center gap-2 pb-1">
          {unreadCount > 0 && (
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
              style={{ background: "rgba(119,255,51,0.12)", color: "#77ff33" }}
            >
              {unreadCount} unread
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[10px] text-white/50">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "#77ff33", boxShadow: "0 0 6px #77ff33" }}
            />
            {onlineCount} online
          </span>
        </div>
      </header>

      <div className="liquid-card overflow-hidden rounded-3xl">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-white/5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-white/40"
              >
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z" />
              </svg>
            </div>
            <p className="text-sm text-white/60">No conversations yet</p>
            <p className="mt-1 text-[11px] text-white/40">
              {isAdmin
                ? "Other users will appear here once they're added."
                : "You can only message admins. An admin will appear here once one is added."}
            </p>
          </div>
        ) : (
          conversations.map((c, i) => (
            <button
              key={String(c.user.id)}
              onClick={() => open(i)}
              className={`liquid-nav-item fade-in flex w-full items-center gap-3 px-4 py-3 text-left ${
                i !== conversations.length - 1 ? "border-b border-white/5" : ""
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="relative shrink-0">
                <div
                  className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white/10 text-xs font-semibold text-white/90 ring-1 ring-white/15"
                  style={
                    c.user.avatar && c.user.avatar.startsWith("http")
                      ? {
                          backgroundImage: `url(${c.user.avatar})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {(!c.user.avatar || !c.user.avatar.startsWith("http")) &&
                    c.user.avatar}
                </div>
                {c.user.active && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-black"
                    style={{ background: "#77ff33" }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-white">
                    {c.user.name}
                  </p>
                  {c.user.role === "Admin" && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{
                        background: "rgba(251,191,36,0.15)",
                        color: "#fbbf24",
                      }}
                    >
                      Admin
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                  <span>@{c.user.username}</span>
                  <span>•</span>
                  <span className="truncate">{c.lastText || "No messages yet"}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {c.lastTime && (
                  <span className="text-[10px] text-white/40">
                    {c.lastTime}
                  </span>
                )}
                {(unreadByUser[String(c.user.id)] || 0) > 0 && (
                  <span
                    className="grid min-w-[20px] place-items-center rounded-full px-1.5 text-[10px] font-bold text-black"
                    style={{
                      background: "#77ff33",
                      minHeight: 18,
                    }}
                  >
                    {unreadByUser[String(c.user.id)]}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ===== Message bubble =====
function MessageBubble({
  message,
  onPreview,
}: {
  message: ChatMessage;
  onPreview: (m: MediaItem) => void;
}) {
  const mine = message.from === "me";
  return (
    <div
      className={`flex fade-in ${mine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl text-sm leading-relaxed ${
          mine
            ? "rounded-br-sm text-black"
            : "rounded-bl-sm bg-white/[0.07] text-white/90"
        } ${message.media ? "overflow-hidden p-0" : "px-3 py-2"}`}
        style={
          mine
            ? {
                background:
                  "linear-gradient(135deg, #77ff33 0%, #5cd91f 100%)",
              }
            : undefined
        }
      >
        {message.media && message.media.type === "image" && (
          <div className="relative">
            <button
              onClick={() => onPreview(message.media!)}
              className="block w-full"
              aria-label="View image"
            >
              <img
                src={message.media.url}
                alt={message.media.name || "attachment"}
                className="block max-h-72 w-full object-cover"
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const a = document.createElement("a");
                a.href = message.media!.url;
                a.download = message.media!.name || "image";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full text-white transition active:scale-90"
              style={{ background: "rgba(0,0,0,0.6)" }}
              aria-label="Download image"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>
        )}
        {message.media && message.media.type === "file" && (
          <div
            className={`flex w-full items-center gap-3 px-3 py-3 ${
              mine ? "text-black" : "text-white"
            }`}
          >
            <button
              onClick={() => onPreview(message.media!)}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                mine ? "bg-black/15" : "bg-white/10"
              }`}
              aria-label="View file"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </button>
            <button
              onClick={() => onPreview(message.media!)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-semibold">
                {message.media.name}
              </p>
              <p className={`text-[11px] ${mine ? "text-black/60" : "text-white/50"}`}>
                Tap to view
              </p>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const a = document.createElement("a");
                a.href = message.media!.url;
                a.download = message.media!.name || "file";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition active:scale-90 ${
                mine ? "bg-black/15 hover:bg-black/25" : "bg-white/10 hover:bg-white/20"
              }`}
              aria-label="Download"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>
        )}
        {message.text && (
          <div className="px-3 pb-2 pt-1.5">
            <p>{message.text}</p>
            <div
              className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
                mine ? "text-black/60" : "text-white/40"
              }`}
            >
              <span>{message.time}</span>
              {mine && <ReadReceipt read={Boolean(message.read)} />}
            </div>
          </div>
        )}
        {message.media && !message.text && (
          <div
            className={`flex items-center justify-end gap-1 px-3 pb-1.5 pt-1 text-[10px] ${
              mine ? "text-black/60" : "text-white/40"
            }`}
          >
            <span>{message.time}</span>
            {mine && <ReadReceipt read={Boolean(message.read)} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Read receipt tick =====
function ReadReceipt({ read }: { read: boolean }) {
  if (!read) {
    // Single grey tick = sent (but not yet delivered/read)
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3 w-3"
        aria-label="sent"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  // Double green tick = read
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
      style={{ color: "#4ade80" }}
      aria-label="read"
    >
      <polyline points="18 6 9 17 4 12" />
      <polyline points="22 10 13 21 11 19" />
    </svg>
  );
}

// ===== Pending media preview =====
function PendingMediaPreview({
  media,
  onRemove,
}: {
  media: MediaItem;
  onRemove: () => void;
}) {
  return (
    <div
      className="liquid-card flex items-center gap-3 rounded-2xl p-2"
      style={{ animation: "slideUp 0.3s ease-out" }}
    >
      {media.type === "image" ? (
        <img
          src={media.url}
          alt={media.name}
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/10 text-white/70">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {media.name || "Attachment"}
        </p>
        <p className="text-[11px] text-white/50">
          {media.type === "image" ? "Photo" : "File"}
          {media.size ? ` · ${(media.size / 1024).toFixed(1)} KB` : ""}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-white/70 transition hover:bg-white/10"
        aria-label="Remove attachment"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ===== Attach menu =====
function AttachMenu({
  onCamera,
  onGallery,
  onDocument,
  onClose,
}: {
  onCamera: () => void;
  onGallery: () => void;
  onDocument: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-10"
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.4)" }}
      />
      <div
        className="liquid-card relative z-20 mt-3 rounded-2xl p-2 fade-in"
        style={{ animation: "slideUp 0.25s ease-out" }}
      >
        <div className="grid grid-cols-3 gap-2">
          <AttachButton
            label="Camera"
            onClick={onCamera}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            }
          />
          <AttachButton
            label="Gallery"
            onClick={onGallery}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            }
          />
          <AttachButton
            label="Document"
            onClick={onDocument}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            }
          />
        </div>
      </div>
    </>
  );
}

function AttachButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 p-3 text-white/80 transition hover:bg-white/10"
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-full"
        style={{ background: "rgba(119,255,51,0.12)", color: "#77ff33" }}
      >
        {icon}
      </span>
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

// ===== Media lightbox =====
function MediaLightbox({
  media,
  onClose,
}: {
  media: MediaItem;
  onClose: () => void;
}) {
  // Download the file to the user's device
  const download = () => {
    const a = document.createElement("a");
    a.href = media.url;
    a.download = media.name || `iconnect-${Date.now()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
      onClick={onClose}
      style={{ animation: "fadeIn 0.2s ease-out" }}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Close"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      {/* Download button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          download();
        }}
        className="absolute right-16 top-4 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-white transition active:scale-95"
        style={{ background: "rgba(119,255,51,0.18)" }}
        aria-label="Download"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download
      </button>
      {media.type === "image" ? (
        <img
          src={media.url}
          alt={media.name}
          className="max-h-full max-w-full rounded-xl"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="liquid-card max-w-sm rounded-2xl p-6 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-white/70">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="font-display text-base font-semibold">{media.name}</p>
          <p className="mt-1 text-[11px] text-white/50">
            {media.size
              ? `${(media.size / 1024).toFixed(1)} KB`
              : "Tap download to save"}
          </p>
          <button
            onClick={download}
            className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-black transition active:scale-95"
            style={{ background: "rgba(119,255,51,0.9)" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}


