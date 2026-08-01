import {
  useState,
  useRef,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import type { User, Role } from "../types/user";
import { api } from "../lib/api";
import { formatRelativeTime } from "../utils/time";

// In a production app, the current password would be verified against
// the database (e.g. via supabase.auth.signInWithPassword). For now the
// change-password flow just checks that the new fields are filled and
// that the new password + confirmation match.

export default function Settings({
  users,
  setUsers,
  isAdmin = true,
  onSignOut,
  currentUser,
}: {
  users: User[];
  setUsers: Dispatch<SetStateAction<User[]>>;
  isAdmin?: boolean;
  currentUser?: User | null;
  onSignOut?: () => void;
}) {
  const [activeSection, setActiveSection] = useState<"profile" | "users" | "create">(
    "profile"
  );
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const me = currentUser || users[0];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">App</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Settings</h1>
      </header>

      {/* Section tabs - Users and Create are admin-only */}
      <div className="liquid-card flex gap-1 rounded-2xl p-1">
        <TabButton
          label="Profile"
          active={activeSection === "profile"}
          onClick={() => setActiveSection("profile")}
        />
        {isAdmin && (
          <>
            <TabButton
              label="Users"
              active={activeSection === "users"}
              onClick={() => setActiveSection("users")}
            />
            <TabButton
              label="Create"
              active={activeSection === "create"}
              onClick={() => setActiveSection("create")}
            />
          </>
        )}
      </div>

      {!isAdmin && (
        <div className="liquid-card rounded-3xl p-5 text-center">
          <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-white/5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-white/40"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-white">Admins only</p>
          <p className="mt-1 text-[11px] text-white/50">
            User management and account creation are restricted to admins.
          </p>
        </div>
      )}

      {activeSection === "profile" && (
        <ProfileSection
          me={me}
          setUsers={setUsers}
          onSignOut={onSignOut}
        />
      )}
      {isAdmin && activeSection === "users" && (
        <UsersSection users={users} onUserClick={setSelectedUser} />
      )}
      {isAdmin && activeSection === "create" && (
        <CreateUserSection users={users} setUsers={setUsers} />
      )}

      {/* User detail modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          isMe={selectedUser.id === me.id}
        />
      )}
    </div>
  );
}

// ===== Tab button =====
function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
          : "text-white/60 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

// ===== 1. Profile Section =====
function ProfileSection({
  me,
  setUsers,
  onSignOut,
}: {
  me: User;
  setUsers: Dispatch<SetStateAction<User[]>>;
  onSignOut?: () => void;
}) {
  const [name, setName] = useState(me.name);
  const [avatar, setAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Inline success messages for the profile card
  const [nameSuccess, setNameSuccess] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);

  // Password change
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const saveName = async () => {
    const newName = name.trim();
    if (!newName) return;
    if (newName === me.name) {
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 2500);
      return;
    }
    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === me.id ? { ...u, name: newName } : u))
    );
    setNameSuccess(false);
    try {
      await api.updateUserName(me.id, newName);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save name:", err);
      setNameSuccess(false);
    }
  };

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const saveAvatar = async () => {
    if (!avatar) return;
    setAvatarUploading(true);
    setAvatarError("");
    setAvatarSuccess(false);
    try {
      // Upload to Supabase Storage and save the URL
      const publicUrl = await api.uploadAvatar(
        me.id,
        avatar,
        "avatar"
      );
      // Update the local users list
      setUsers((prev) =>
        prev.map((u) => (u.id === me.id ? { ...u, avatar: publicUrl } : u))
      );
      // Clear the local data URL since we now have a remote URL
      setAvatar(null);
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 3000);
    } catch (err: any) {
      console.error("Upload avatar error:", err);
      setAvatarError(err?.message || "Failed to upload photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  const [pwLoading, setPwLoading] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);

    if (!pwCurrent) {
      setPwError("Enter your current password");
      return;
    }
    if (!pwNew || pwNew.length < 6) {
      setPwError("New password must be at least 6 characters");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("New passwords do not match");
      return;
    }

    setPwLoading(true);
    try {
      // Verify current password + update in the database via RPC.
      // The RPC compares p_current_password with the stored
      // password_hash and raises if they don't match.
      await api.changePassword(me.id, pwCurrent, pwNew);
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: any) {
      // Show the friendly error message from the API
      setPwError(err?.message || "Failed to change password");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <div className="liquid-card rounded-3xl p-5">
        <p className="text-xs uppercase tracking-widest text-white/40">Profile</p>
        <h3 className="mt-1 font-display text-lg font-semibold">Your account</h3>

        {/* Avatar */}
        <div className="mt-4 flex flex-col items-center">
          <div className="relative">
            <div
              className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-white/10 text-2xl font-bold text-white ring-2 ring-white/15"
              style={
                avatar
                  ? {
                      backgroundImage: `url(${avatar})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : me.avatar && me.avatar.startsWith("http")
                  ? {
                      backgroundImage: `url(${me.avatar})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              {!avatar && !me.avatar?.startsWith("http") && me.avatar}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full text-black shadow-lg transition active:scale-95"
              style={{ background: "#77ff33" }}
              aria-label="Change avatar"
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
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          {avatar && (
            <button
              onClick={saveAvatar}
              disabled={avatarUploading}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-black transition active:scale-[0.98] disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #77ff33 0%, #5cd91f 100%)",
                boxShadow: "0 2px 8px rgba(119,255,51,0.3)",
              }}
            >
              {avatarUploading ? (
                <>
                  <span
                    className="h-3 w-3 rounded-full border-2 border-black/30 border-t-black"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  />
                  Uploading...
                </>
              ) : (
                "Save Photo"
              )}
            </button>
          )}
          {avatarError && (
            <p
              className="mt-2 rounded-lg border px-2 py-1 text-center text-[11px]"
              style={{
                background: "rgba(255,93,93,0.08)",
                borderColor: "rgba(255,93,93,0.2)",
                color: "#ff8a8a",
              }}
            >
              {avatarError}
            </p>
          )}
          {avatarSuccess && (
            <p
              className="mt-2 rounded-lg border px-2 py-1 text-center text-[11px]"
              style={{
                background: "rgba(119,255,51,0.08)",
                borderColor: "rgba(119,255,51,0.3)",
                color: "#77ff33",
              }}
            >
              ✓ Profile photo updated
            </p>
          )}
        </div>

        {/* Name field */}
        <div className="mt-5 space-y-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/70">
              User Name
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 focus-within:border-white/30">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white outline-none"
                style={{ color: "#fff" }}
              />
            </div>
          </div>
          <button
            onClick={saveName}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #77ff33 0%, #5cd91f 100%)",
              boxShadow: "0 4px 14px rgba(119,255,51,0.4)",
            }}
          >
            {nameSuccess ? "✓ Saved" : "Save Name"}
          </button>
          {nameSuccess && (
            <p
              className="rounded-lg border px-3 py-2 text-center text-[12px]"
              style={{
                background: "rgba(119,255,51,0.08)",
                borderColor: "rgba(119,255,51,0.3)",
                color: "#77ff33",
              }}
            >
              ✓ Name updated successfully
            </p>
          )}
        </div>
      </div>

      {/* Change password card */}
      <form onSubmit={changePassword} className="liquid-card rounded-3xl p-5">
        <p className="text-xs uppercase tracking-widest text-white/40">Security</p>
        <h3 className="mt-1 font-display text-lg font-semibold">Change password</h3>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Current password
            </label>
            <div
              className="flex items-center gap-2 rounded-xl border bg-white/[0.04] px-3.5 py-3 focus-within:border-white/30"
              style={{
                borderColor: pwError
                  ? "rgba(255,93,93,0.6)"
                  : "rgba(255,255,255,0.08)",
              }}
            >
              <input
                type="password"
                value={pwCurrent}
                onChange={(e) => {
                  setPwCurrent(e.target.value);
                  setPwError("");
                }}
                placeholder="Enter current password"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder-white/40"
                style={{ color: "#fff" }}
              />
            </div>
            <p className="mt-1 text-[10px] text-white/40">
              Enter your current password to change it
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/70">
              New password
            </label>
            <div
              className="flex items-center gap-2 rounded-xl border bg-white/[0.04] px-3.5 py-3 focus-within:border-white/30"
              style={{
                borderColor: pwError
                  ? "rgba(255,93,93,0.6)"
                  : "rgba(255,255,255,0.08)",
              }}
            >
              <input
                type="password"
                value={pwNew}
                onChange={(e) => {
                  setPwNew(e.target.value);
                  setPwError("");
                }}
                placeholder="At least 6 characters"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder-white/40"
                style={{ color: "#fff" }}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Confirm new password
            </label>
            <div
              className="flex items-center gap-2 rounded-xl border bg-white/[0.04] px-3.5 py-3 focus-within:border-white/30"
              style={{
                borderColor: pwError
                  ? "rgba(255,93,93,0.6)"
                  : "rgba(255,255,255,0.08)",
              }}
            >
              <input
                type="password"
                value={pwConfirm}
                onChange={(e) => {
                  setPwConfirm(e.target.value);
                  setPwError("");
                }}
                placeholder="Re-enter new password"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder-white/40"
                style={{ color: "#fff" }}
              />
            </div>
          </div>

          {pwError && (
            <p
              className="rounded-lg border px-3 py-2 text-[12px]"
              style={{
                background: "rgba(255,93,93,0.08)",
                borderColor: "rgba(255,93,93,0.2)",
                color: "#ff8a8a",
              }}
            >
              {pwError}
            </p>
          )}

          {pwSuccess && (
            <p
              className="rounded-lg border px-3 py-2 text-[12px]"
              style={{
                background: "rgba(119,255,51,0.08)",
                borderColor: "rgba(119,255,51,0.3)",
                color: "#77ff33",
              }}
            >
              ✓ Password changed successfully
            </p>
          )}

          <button
            type="submit"
            disabled={pwLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-60"
          >
            {pwLoading ? (
              <>
                <span
                  className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white/80"
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </button>
        </div>
      </form>

      {/* Sign out */}
      {onSignOut && (
        <button
          onClick={onSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition active:scale-[0.98]"
          style={{
            background: "rgba(255, 93, 93, 0.08)",
            borderColor: "rgba(255, 93, 93, 0.25)",
            color: "#ff8a8a",
          }}
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
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      )}
    </div>
  );
}

// ===== 2. Users Section =====
function UsersSection({
  users,
  onUserClick,
}: {
  users: User[];
  onUserClick: (u: User) => void;
}) {
  const activeCount = users.filter((u) => u.active).length;
  const adminCount = users.filter((u) => u.role === "Admin").length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="liquid-card rounded-2xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Total</p>
          <p className="mt-1 text-lg font-semibold text-white">{users.length}</p>
        </div>
        <div className="liquid-card rounded-2xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Active</p>
          <p className="mt-1 text-lg font-semibold" style={{ color: "#77ff33" }}>
            {activeCount}
          </p>
        </div>
        <div className="liquid-card rounded-2xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Admins</p>
          <p className="mt-1 text-lg font-semibold text-amber-300">{adminCount}</p>
        </div>
      </div>

      {/* Active users section */}
      <div className="liquid-card rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: "#77ff33", boxShadow: "0 0 6px #77ff33" }}
            />
            <p className="text-xs uppercase tracking-widest text-white/60">
              Active users
            </p>
          </div>
          <p className="text-[10px] text-white/40">{activeCount} online</p>
        </div>
        {users
          .filter((u) => u.active)
          .map((u, i, arr) => (
            <UserRow
              key={u.id}
              user={u}
              isLast={i === arr.length - 1}
              onClick={() => onUserClick(u)}
            />
          ))}
      </div>

      {/* All users section */}
      <div className="liquid-card rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-white/60">All users</p>
          <p className="text-[10px] text-white/40">{users.length} total · tap to view</p>
        </div>
        {users.map((u, i) => (
          <UserRow
            key={u.id}
            user={u}
            isLast={i === users.length - 1}
            showStatus
            onClick={() => onUserClick(u)}
          />
        ))}
      </div>
    </div>
  );
}

// ===== User row =====
function UserRow({
  user,
  isLast,
  showStatus,
  onClick,
}: {
  user: User;
  isLast: boolean;
  showStatus?: boolean;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
        isLast ? "" : "border-b border-white/5"
      } ${
        interactive
          ? "active:bg-white/[0.06] hover:bg-white/[0.04] cursor-pointer"
          : "cursor-default"
      }`}
    >
      <div className="relative shrink-0">
        <div
          className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white/10 text-xs font-semibold text-white/90 ring-1 ring-white/15"
          style={
            user.avatar && user.avatar.startsWith("http")
              ? {
                  backgroundImage: `url(${user.avatar})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {(!user.avatar || !user.avatar.startsWith("http")) && user.avatar}
        </div>
        {user.active && (
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-black"
            style={{ background: "#77ff33" }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          {user.role === "Admin" && (
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
          <span>@{user.username}</span>
          <span>•</span>
          <span className="font-mono">{user.password}</span>
          {showStatus && (
            <>
              <span>•</span>
              <span
                style={{ color: user.active ? "#77ff33" : "rgba(255,255,255,0.4)" }}
              >
                {formatRelativeTime(user.lastActive)}
              </span>
            </>
          )}
        </div>
      </div>
      {interactive && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 text-white/40"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </button>
  );
}

// ===== User detail modal =====
function UserDetailModal({
  user,
  onClose,
  isMe,
}: {
  user: User;
  onClose: () => void;
  isMe: boolean;
}) {
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10"
        style={{
          animation: "scaleIn 0.3s ease-out",
          background: "linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)",
          boxShadow:
            "0 25px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05) inset",
          maxHeight: "min(90vh, 90dvh, 720px)",
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-4"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <h2 className="font-display text-lg font-semibold text-white">
            User Details
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80 transition hover:bg-white/20"
            aria-label="Close"
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
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto px-5 py-5"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          {/* Avatar + name */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div
                className="grid h-24 w-24 place-items-center overflow-hidden rounded-full text-2xl font-bold ring-2 ring-white/15"
                style={
                  user.avatar && user.avatar.startsWith("http")
                    ? {
                        backgroundImage: `url(${user.avatar})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        background:
                          "linear-gradient(135deg, rgba(119,255,51,0.05) 0%, rgba(119,255,51,0) 100%)",
                      }
                    : {
                        background:
                          user.role === "Admin"
                            ? "linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(251,191,36,0.05) 100%)"
                            : "linear-gradient(135deg, rgba(119,255,51,0.2) 0%, rgba(119,255,51,0.05) 100%)",
                        color: "#fff",
                      }
                }
              >
                {(!user.avatar || !user.avatar.startsWith("http")) && user.avatar}
              </div>
              {user.active && (
                <span
                  className="absolute bottom-1 right-1 h-3 w-3 rounded-full ring-2 ring-black"
                  style={{ background: "#77ff33" }}
                />
              )}
            </div>
            <h3 className="mt-3 font-display text-xl font-semibold text-white">
              {user.name}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={
                  user.role === "Admin"
                    ? {
                        background: "rgba(251,191,36,0.15)",
                        color: "#fbbf24",
                      }
                    : {
                        background: "rgba(119,255,51,0.15)",
                        color: "#77ff33",
                      }
                }
              >
                {user.role}
              </span>
              {isMe && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: "rgba(99,102,241,0.15)",
                    color: "#a5b4fc",
                  }}
                >
                  You
                </span>
              )}
              {user.active && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: "rgba(119,255,51,0.15)",
                    color: "#77ff33",
                  }}
                >
                  Online
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-white/50">@{user.username}</p>
          </div>

          {/* Info grid */}
          <div className="mt-6 space-y-2">
            <InfoRow label="Full name" value={user.name} />
            <InfoRow label="Username" value={`@${user.username}`} mono />
            <InfoRow
              label="Password"
              value={user.password}
              mono
              secret
            />
            <InfoRow label="Phone" value={user.phone} mono />
            <InfoRow label="Role" value={user.role} />
            <InfoRow
              label="Status"
              value={user.active ? "Active" : "Offline"}
              valueColor={user.active ? "#77ff33" : "rgba(255,255,255,0.5)"}
            />
            <InfoRow label="Last active" value={formatRelativeTime(user.lastActive)} />
            <InfoRow label="Joined" value={formatRelativeTime(user.joined)} />
          </div>

          {/* Action buttons */}
          <div className="mt-6 space-y-2">
            {isMe ? (
              <div
                className="rounded-xl border px-4 py-3 text-center text-[12px]"
                style={{
                  background: "rgba(99,102,241,0.08)",
                  borderColor: "rgba(99,102,241,0.2)",
                  color: "#a5b4fc",
                }}
              >
                This is your account
              </div>
            ) : (
              <button
                onClick={onClose}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.98]"
                style={{
                  background:
                    "linear-gradient(135deg, #77ff33 0%, #5cd91f 100%)",
                  boxShadow: "0 4px 14px rgba(119,255,51,0.4)",
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ===== Info row =====
function InfoRow({
  label,
  value,
  mono,
  secret,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  secret?: boolean;
  valueColor?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const display =
    secret && !revealed ? "•".repeat(Math.max(value.length, 6)) : value;
  return (
    <div
      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5"
    >
      <p className="text-[11px] uppercase tracking-wider text-white/40">{label}</p>
      <div className="flex items-center gap-2">
        <p
          className={`text-sm ${mono ? "font-mono" : ""}`}
          style={{ color: valueColor || "#fff" }}
        >
          {display}
        </p>
        {secret && (
          <button
            onClick={() => setRevealed((v) => !v)}
            className="grid h-6 w-6 place-items-center rounded-md bg-white/5 text-white/60 transition hover:bg-white/10"
            aria-label={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ===== 3. Create User Section =====
function CreateUserSection({
  users,
  setUsers,
}: {
  users: User[];
  setUsers: Dispatch<SetStateAction<User[]>>;
}) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "Client" as Role,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Required";
    if (!form.username.trim()) newErrors.username = "Required";
    else if (
      users.some((u) => u.username.toLowerCase() === form.username.toLowerCase())
    )
      newErrors.username = "Username already exists";
    if (!form.phone.trim()) newErrors.phone = "Required";
    else if (form.phone.replace(/\D/g, "").length < 7)
      newErrors.phone = "Phone must contain at least 7 digits";
    if (!form.password) newErrors.password = "Required";
    else if (form.password.length < 6) newErrors.password = "Min 6 characters";
    if (form.password !== form.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      // Call the database RPC — the trigger creates the per-user chat table
      const newUser = await api.createUser({
        name: form.name.trim(),
        username: form.username.trim(),
        phone: form.phone.trim(),
        role: form.role,
        password: form.password,
      });
      setUsers((prev) => [newUser, ...prev]);
      setForm({
        name: "",
        username: "",
        phone: "",
        password: "",
        confirmPassword: "",
        role: "Client",
      });
      setErrors({});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Create user error:", err);
      setErrors({ username: "Failed to create user (maybe duplicate)" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="liquid-card rounded-3xl p-5">
        <p className="text-xs uppercase tracking-widest text-white/40">New user</p>
        <h3 className="mt-1 font-display text-lg font-semibold">Create account</h3>

        <div className="mt-4 space-y-3">
          <FieldInput
            label="Name"
            required
            error={errors.name}
            placeholder="Full name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <FieldInput
            label="Username"
            required
            error={errors.username}
            placeholder="unique_username"
            value={form.username}
            onChange={(v) =>
              setForm({ ...form, username: v.toLowerCase().replace(/\s/g, "") })
            }
            mono
          />
          <FieldInput
            label="Phone number"
            required
            error={errors.phone}
            placeholder="+94 77 123 4567"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            type="tel"
          />
          <FieldInput
            label="Password"
            required
            error={errors.password}
            placeholder="At least 6 characters"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            type="password"
          />
          <FieldInput
            label="Confirm password"
            required
            error={errors.confirmPassword}
            placeholder="Re-enter password"
            value={form.confirmPassword}
            onChange={(v) => setForm({ ...form, confirmPassword: v })}
            type="password"
          />

          {/* Role */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <RoleButton
                label="Admin"
                description="Full access"
                active={form.role === "Admin"}
                color="#fbbf24"
                onClick={() => setForm({ ...form, role: "Admin" })}
              />
              <RoleButton
                label="Client"
                description="Standard user"
                active={form.role === "Client"}
                color="#77ff33"
                onClick={() => setForm({ ...form, role: "Client" })}
              />
            </div>
          </div>

          {success && (
            <p
              className="rounded-lg border px-3 py-2 text-[12px]"
              style={{
                background: "rgba(119,255,51,0.08)",
                borderColor: "rgba(119,255,51,0.3)",
                color: "#77ff33",
              }}
            >
              ✓ User created successfully
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.98] disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #77ff33 0%, #5cd91f 100%)",
              boxShadow: "0 4px 14px rgba(119,255,51,0.4)",
            }}
          >
            {submitting ? (
              <>
                <span
                  className="h-3 w-3 rounded-full border-2 border-black/30 border-t-black"
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
                Creating...
              </>
            ) : (
              "Create User"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

// ===== Field input =====
function FieldInput({
  label,
  required,
  error,
  placeholder,
  value,
  onChange,
  type = "text",
  mono,
}: {
  label: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/70">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      <div
        className="flex items-center gap-2 rounded-xl px-3.5 py-3 transition focus-within:bg-white/[0.08]"
        style={{
          background: "rgba(118, 118, 128, 0.16)",
          border: error ? "1px solid rgba(255,93,93,0.6)" : "1px solid transparent",
          boxShadow: error ? "0 0 0 3px rgba(255,93,93,0.1)" : "none",
        }}
      >
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 bg-transparent text-sm text-white outline-none placeholder-white/40 ${
            mono ? "font-mono" : ""
          }`}
          style={{ color: "#fff" }}
        />
      </div>
      {error && (
        <p className="mt-1 text-[11px] font-medium" style={{ color: "#ff5d5d" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ===== Role button =====
function RoleButton({
  label,
  description,
  active,
  color,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition active:scale-[0.98]"
      style={{
        background: active ? `${color}1a` : "rgba(255,255,255,0.04)",
        borderColor: active ? `${color}80` : "rgba(255,255,255,0.08)",
        boxShadow: active ? `0 0 0 1px ${color}40` : "none",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: active ? color : "rgba(255,255,255,0.3)" }}
        />
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>
      <span className="text-[10px] text-white/50">{description}</span>
    </button>
  );
}
