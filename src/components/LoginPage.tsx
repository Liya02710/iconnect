import { useState, type FormEvent } from "react";
import { api } from "../lib/api";

type LoginPageProps = {
  onLogin: (username: string, password: string) => boolean | Promise<boolean>;
  onSignedUp?: (username: string, password: string) => void;
  onForgotPassword?: () => void;
};

export default function LoginPage({
  onLogin,
  onSignedUp,
  onForgotPassword,
}: LoginPageProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"Admin" | "Client">("Client");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setUsername("");
    setPassword("");
    setName("");
    setPhone("");
    setRole("Client");
    setError("");
    setInfo("");
  };

  const switchMode = (next: "signin" | "signup") => {
    reset();
    setMode(next);
  };

  const submitSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!username.trim() || !password) {
      setError("Enter your username and password");
      return;
    }
    setLoading(true);
    try {
      const ok = await Promise.resolve(onLogin(username.trim(), password));
      if (!ok) {
        setError("Invalid username or password");
        setLoading(false);
      }
    } catch (err: any) {
      // Show the actual error so CORS / network issues are visible
      const msg = err?.message || "Login failed. Please try again.";
      console.error("Login error:", err);
      setError(
        msg.toLowerCase().includes("fetch") ||
          msg.toLowerCase().includes("network") ||
          msg.toLowerCase().includes("cors")
          ? "Cannot reach the server. Check your internet connection or CORS settings."
          : msg
      );
      setLoading(false);
    }
  };

  const submitSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!name.trim()) return setError("Name is required");
    if (!username.trim()) return setError("Username is required");
    if (!phone.trim()) return setError("Phone is required");
    if (phone.replace(/\D/g, "").length < 7)
      return setError("Phone must contain at least 7 digits");
    if (password.length < 6)
      return setError("Password must be at least 6 characters");

    setLoading(true);
    try {
      const newUser = await api.createUser({
        name: name.trim(),
        username: username.trim(),
        phone: phone.trim(),
        role,
        password,
      });
      setInfo(
        `Account created for @${newUser.username}. You can sign in now.`
      );
      setMode("signin");
      setPassword("");
      setUsername(newUser.username);
      setLoading(false);
      onSignedUp?.(newUser.username, password);
    } catch (err: any) {
      console.error("Create account error:", err);
      // Supabase errors come in many shapes. Extract whatever is useful.
      const parts: string[] = [];
      if (err?.message) parts.push(err.message);
      if (err?.details) parts.push(err.details);
      if (err?.hint) parts.push(err.hint);
      if (err?.error_description) parts.push(err.error_description);
      const raw = parts.join(" | ") || "Unknown error";

      let msg = raw;
      const low = raw.toLowerCase();
      if (low.includes("duplicate") || low.includes("unique")) {
        msg = "That username is already taken";
      } else if (low.includes("phone")) {
        msg = `Phone issue: ${raw}`;
      } else if (low.includes("username")) {
        msg = `Username issue: ${raw}`;
      } else if (low.includes("null value")) {
        msg = `Missing required field: ${raw}`;
      }
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[58] flex items-center justify-center overflow-hidden bg-black"
      style={{ animation: "fadeIn 0.5s ease-out" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 h-96 w-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(119,255,51,0.15) 0%, rgba(119,255,51,0) 70%)",
            filter: "blur(60px)",
            animation: "orbFloat1 6s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0) 70%)",
            filter: "blur(60px)",
            animation: "orbFloat2 7s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(244,114,182,0.08) 0%, rgba(244,114,182,0) 70%)",
            filter: "blur(60px)",
            animation: "orbFloat3 8s ease-in-out infinite",
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 15 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              background: i % 3 === 0 ? "#77ff33" : "rgba(255,255,255,0.3)",
              boxShadow: i % 3 === 0 ? "0 0 6px #77ff33" : "none",
              animation: `particleFloat ${4 + (i % 3)}s ease-in-out ${
                (i * 0.2) % 3
              }s infinite`,
            }}
          />
        ))}
      </div>

      <div
        className="relative z-10 mx-4 w-full max-w-md"
        style={{ animation: "scaleIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both" }}
      >
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(119,255,51,0.2) 0%, rgba(119,255,51,0.05) 100%)",
              border: "1px solid rgba(119,255,51,0.3)",
              boxShadow: "0 0 40px rgba(119,255,51,0.3)",
              animation: "pulseGlow 3s ease-in-out infinite",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#77ff33"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
            >
              <path d="M3 11.5 12 4l9 7.5" />
              <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
            </svg>
          </div>
          <h1
            className="font-brand text-5xl font-bold leading-none"
            style={{
              color: "#77ff33",
              textShadow: "0 0 30px rgba(119,255,51,0.4)",
            }}
          >
            ICONNECT
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.4em] text-white/50">
            Your digital wallet
          </p>
        </div>

        <div
          className="rounded-3xl p-6"
          style={{
            background: "rgba(28, 28, 30, 0.78)",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            border: "0.5px solid rgba(255,255,255,0.18)",
            boxShadow:
              "0 1px 0 0 rgba(255,255,255,0.1) inset, 0 25px 80px rgba(0,0,0,0.8)",
          }}
        >
          <div
            className="mb-5 grid grid-cols-2 gap-1 rounded-2xl p-1"
            style={{ background: "rgba(118, 118, 128, 0.12)" }}
          >
            <ModeTab
              label="Sign in"
              active={mode === "signin"}
              onClick={() => switchMode("signin")}
            />
          </div>

          <h2 className="mb-1 font-display text-xl font-semibold text-white">
            {mode === "signin" ? "Welcome back" : "Get started"}
          </h2>
          <p className="mb-5 text-[12px] text-white/50">
            {mode === "signin"
              ? "Sign in to continue to ICONNECT"
              : "Create your ICONNECT account in seconds"}
          </p>

          {mode === "signin" ? (
            <form onSubmit={submitSignIn} className="space-y-3">
              <FormField
                label="Username"
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-white/40"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
                placeholder="Enter username"
                value={username}
                onChange={(v) => {
                  setUsername(v);
                  setError("");
                  setInfo("");
                }}
                autoComplete="username"
              />

              <PasswordField
                label="Password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setError("");
                  setInfo("");
                }}
                placeholder="Enter password"
                showPassword={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
                autoComplete="current-password"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-[11px] font-medium transition"
                  style={{ color: "#77ff33" }}
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <p
                  className="rounded-lg border px-3 py-2 text-[12px]"
                  style={{
                    background: "rgba(255,93,93,0.08)",
                    borderColor: "rgba(255,93,93,0.2)",
                    color: "#ff8a8a",
                  }}
                >
                  {error}
                </p>
              )}

              {info && (
                <p
                  className="rounded-lg border px-3 py-2 text-[12px]"
                  style={{
                    background: "rgba(119,255,51,0.08)",
                    borderColor: "rgba(119,255,51,0.3)",
                    color: "#77ff33",
                  }}
                >
                  {info}
                </p>
              )}

              <PrimaryButton loading={loading} type="submit">
                Sign In
              </PrimaryButton>
            </form>
          ) : (
            <form onSubmit={submitSignUp} className="space-y-3">
              <FormField
                label="Full name"
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-white/40"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
                placeholder="Your full name"
                value={name}
                onChange={(v) => {
                  setName(v);
                  setError("");
                }}
                autoComplete="name"
              />

              <FormField
                label="Username"
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-white/40"
                  >
                    <path d="M4 4h16v16H4z" />
                    <path d="M9 9h6v6H9z" />
                  </svg>
                }
                placeholder="Choose a username"
                value={username}
                onChange={(v) => {
                  setUsername(v);
                  setError("");
                }}
                autoComplete="username"
              />

              <FormField
                label="Phone"
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-white/40"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                }
                placeholder="+94 77 123 4567"
                value={phone}
                onChange={(v) => {
                  setPhone(v);
                  setError("");
                }}
                type="tel"
                autoComplete="tel"
              />

              <PasswordField
                label="Password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setError("");
                }}
                placeholder="At least 6 characters"
                showPassword={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
                autoComplete="new-password"
              />

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <RoleButton
                    label="Admin"
                    description="Full access"
                    active={role === "Admin"}
                    color="#fbbf24"
                    onClick={() => setRole("Admin")}
                  />
                  <RoleButton
                    label="Client"
                    description="Standard user"
                    active={role === "Client"}
                    color="#77ff33"
                    onClick={() => setRole("Client")}
                  />
                </div>
              </div>

              {error && (
                <p
                  className="rounded-lg border px-3 py-2 text-[12px]"
                  style={{
                    background: "rgba(255,93,93,0.08)",
                    borderColor: "rgba(255,93,93,0.2)",
                    color: "#ff8a8a",
                  }}
                >
                  {error}
                </p>
              )}

              <PrimaryButton loading={loading} type="submit">
                Create Account
              </PrimaryButton>

              <p className="text-center text-[10px] text-white/40">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="font-medium"
                  style={{ color: "#77ff33" }}
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] tracking-wider text-white/30">
          Secure login · End-to-end encrypted
        </p>
      </div>
    </div>
  );
}

function ModeTab({
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
      type="button"
      onClick={onClick}
      className="rounded-xl px-3 py-2 text-[12px] font-semibold transition"
      style={{
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        color: active ? "#fff" : "rgba(255,255,255,0.5)",
        boxShadow: active
          ? "0 1px 0 0 rgba(255,255,255,0.08) inset"
          : "none",
      }}
    >
      {label}
    </button>
  );
}

function FormField({
  label,
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
  mono,
  autoComplete,
}: {
  label: string;
  icon?: React.ReactNode;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/60">
        {label}
      </label>
      <div
        className="flex items-center gap-2 rounded-xl px-3.5 py-3 transition focus-within:bg-white/[0.08]"
        style={{ background: "rgba(118, 118, 128, 0.16)" }}
      >
        {icon}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`flex-1 bg-transparent text-sm text-white outline-none placeholder-white/40 ${
            mono ? "font-mono" : ""
          }`}
          style={{ color: "#fff" }}
        />
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  showPassword,
  onToggleShow,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  showPassword: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/60">
        {label}
      </label>
      <div
        className="flex items-center gap-2 rounded-xl px-3.5 py-3 transition focus-within:bg-white/[0.08]"
        style={{ background: "rgba(118, 118, 128, 0.16)" }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 text-white/40"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder-white/40"
          style={{ color: "#fff" }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="grid h-6 w-6 place-items-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white/80"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
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
              className="h-3.5 w-3.5"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

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

function PrimaryButton({
  loading,
  children,
  type = "button",
}: {
  loading: boolean;
  children: React.ReactNode;
  type?: "submit" | "button";
}) {
  return (
    <button
      type={type}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.98] disabled:opacity-60"
      style={{
        background: "linear-gradient(135deg, #77ff33 0%, #5cd91f 100%)",
        boxShadow: "0 4px 14px rgba(119,255,51,0.4)",
      }}
    >
      {loading ? (
        <>
          <span
            className="h-3 w-3 rounded-full border-2 border-black/30 border-t-black"
            style={{ animation: "spin 0.8s linear infinite" }}
          />
          Please wait...
        </>
      ) : (
        children
      )}
    </button>
  );
}
