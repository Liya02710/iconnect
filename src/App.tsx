import { useState, useEffect, type ReactNode } from "react";
import Home from "./pages/Home";
import Balance from "./pages/Balance";
import Message from "./pages/Message";
import Transaction from "./pages/Transaction";
import Settings from "./pages/Settings";
import SplashScreen from "./components/SplashScreen";
import WelcomeAnimation from "./components/WelcomeAnimation";
import LoginPage from "./components/LoginPage";
import { api, type UiUser } from "./lib/api";

type Tab = "home" | "balance" | "message" | "transaction" | "settings";

const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: "home",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
      </svg>
    ),
  },
  {
    id: "balance",
    label: "Balance",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3V7Z" />
        <path d="M3 9v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" />
        <path d="M3 9h18" />
        <circle cx="17" cy="14" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "message",
    label: "Massage",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z" />
        <path d="M8 11h.01M12 11h.01M16 11h.01" />
      </svg>
    ),
  },
  {
    id: "transaction",
    label: "Transaction",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M7 7h11l-3-3" />
        <path d="M17 17H6l3 3" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function App() {
  const [active, setActive] = useState<Tab>("home");
  const [chatOpen, setChatOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  // Login state — false until user successfully logs in
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // The currently signed-in user (from the database)
  const [currentUser, setCurrentUser] = useState<UiUser | null>(null);
  // All users (loaded from database after login)
  const [users, setUsers] = useState<UiUser[]>([]);
  // Switch between Admin and Client views for the signed-in user (demo)
  const [roleOverride, setRoleOverride] = useState<"Admin" | "Client" | null>(null);

  // Compute effective role (use override if set, otherwise user's actual role)
  const effectiveRole = roleOverride ?? currentUser?.role ?? null;
  const isAdmin = effectiveRole === "Admin";

  // Track the current "session id" — increments on every login so
  // we can use it as a key to force child components to remount.
  const [sessionId, setSessionId] = useState(0);

  // Load all users from database after login AND whenever the
  // current user changes (so re-logging in as a different account
  // refreshes the list).
  useEffect(() => {
    if (!isLoggedIn || !currentUser) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    api
      .listUsers()
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch((err) => console.error("Failed to load users:", err));
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, currentUser?.id, sessionId]);

  // Heartbeat: refresh users every 30s and mark this user as active.
  // This way the "online" indicator in other people's lists stays fresh.
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;
    const tick = () => {
      api.setUserActive(currentUser.id).catch(() => {});
      api
        .listUsers()
        .then(setUsers)
        .catch(() => {});
    };
    // First tick after 5s, then every 30s
    const first = setTimeout(tick, 5_000);
    const interval = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [isLoggedIn, currentUser]);

  // Show login page after splash finishes
  useEffect(() => {
    if (splashDone && !isLoggedIn) {
      // Splash is done, login will be shown via the conditional render below
    }
  }, [splashDone, isLoggedIn]);

  // Show welcome animation after successful login
  useEffect(() => {
    if (isLoggedIn) {
      const t = setTimeout(() => setShowWelcome(true), 200);
      return () => clearTimeout(t);
    }
  }, [isLoggedIn]);

  // Login handler — looks up the user in the database.
  // The LoginPage shows a 500ms loading animation; we just need to
  // confirm the user exists. (Password is not verified in this demo —
  // add real auth with supabase.auth.signInWithPassword() for production.)
  const handleLogin = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    if (!username || !password) return false;
    try {
      const found = await api.getUserByUsername(username);
      if (!found) return false;
      setCurrentUser(found);
      // Persist the current user id for child pages to load per-user data
      try {
        localStorage.setItem("iconnect:currentUserId", String(found.id));
      } catch {}
      // Mark user as active in the database so others see them online
      api.setUserActive(found.id).catch(() => {});
      setIsLoggedIn(true);
      return true;
    } catch (err) {
      console.error("Login error:", err);
      return false;
    }
  };

  // Prevent body scroll when chat is open (mobile)
  useEffect(() => {
    if (chatOpen) {
      document.body.classList.add("chat-open");
    } else {
      document.body.classList.remove("chat-open");
    }
    return () => document.body.classList.remove("chat-open");
  }, [chatOpen]);

  // Hide navbar while welcome is playing or chat/modal is open
  const welcomePlaying = showWelcome && !welcomeDone;
  // When user is NOT logged in, the login page is full-screen —
  // hide the navbar, the main app content, and the footer
  const notLoggedIn = !isLoggedIn;
  const hideNav = chatOpen || modalOpen || welcomePlaying || notLoggedIn;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* Splash / Loading screen */}
      <SplashScreen onDone={() => setSplashDone(true)} />

      {/* Login page - shown after splash, before welcome */}
      {splashDone && !isLoggedIn && (
        <LoginPage
          onLogin={handleLogin}
          onSignedUp={async (username, password) => {
            // After successful sign-up, automatically sign in
            await handleLogin(username, password);
          }}
          onForgotPassword={() => {
            alert("Please contact your administrator to reset your password.");
          }}
        />
      )}

      {/* Welcome animation - shown after successful login */}
      {isLoggedIn && showWelcome && !welcomeDone && (
        <WelcomeAnimation
          userName={currentUser?.name || "there"}
          onComplete={() => setWelcomeDone(true)}
        />
      )}

      {/* Liquid background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="liquid-blob absolute -top-24 -left-20 h-72 w-72 bg-white/[0.04]"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="liquid-blob-2 absolute top-1/3 -right-24 h-80 w-80 bg-white/[0.05]"
          style={{ animationDelay: "-4s" }}
        />
        <div
          className="liquid-blob absolute bottom-1/4 left-1/4 h-64 w-64 bg-white/[0.03]"
          style={{ animationDelay: "-7s" }}
        />
        <div
          className="liquid-blob-2 absolute -bottom-20 right-1/3 h-72 w-72 bg-white/[0.04]"
          style={{ animationDelay: "-10s" }}
        />
      </div>

      {/* Page content - only render when logged in. When not logged in,
          the LoginPage is full-screen and the rest of the app is hidden.
          sessionId changes on every login/signout so all child
          components remount with fresh state. */}
      {isLoggedIn && (
      <main
        key={`main-${currentUser?.id ?? "anon"}-${sessionId}`}
        className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col bg-black px-6 pt-10"
      >
        <div
          key={`${active}-${currentUser?.id ?? "anon"}-${sessionId}`}
          className="fade-in flex-1 pb-40"
        >
          {active === "home" && (
            <Home
              isAdmin={isAdmin}
              userName={currentUser?.name}
              userAvatar={
                currentUser?.avatar &&
                currentUser.avatar.startsWith("http")
                  ? currentUser.avatar
                  : undefined
              }
            />
          )}
          {active === "balance" && <Balance isAdmin={isAdmin} />}
          {active === "message" && currentUser && (
            <Message
              key={`msg-${currentUser.id}-${sessionId}`}
              onChatOpenChange={setChatOpen}
              users={users}
              currentUserId={currentUser.id}
            />
          )}
          {active === "transaction" && (
            <Transaction onModalChange={setModalOpen} isAdmin={isAdmin} />
          )}
          {active === "settings" && (
            <Settings
              users={users}
              setUsers={setUsers}
              isAdmin={isAdmin}
              onSignOut={() => {
                if (currentUser) {
                  api.setUserOffline(currentUser.id).catch(() => {});
                }
                try {
                  localStorage.removeItem("iconnect:currentUserId");
                } catch {}
                // Clear all session state so the login page is fresh
                setCurrentUser(null);
                setUsers([]);
                setRoleOverride(null);
                setWelcomeDone(false);
                setShowWelcome(false);
                setChatOpen(false);
                setModalOpen(false);
                setActive("home");
                setIsLoggedIn(false);
                setSessionId((s) => s + 1);
              }}
            />
          )}
        </div>
      </main>
      )}

      {/* Role indicator - tap to override your view (admin/client) */}
      {isLoggedIn && !chatOpen && !modalOpen && !showWelcome && currentUser && (
        <button
          onClick={() =>
            setRoleOverride((r) => (r === "Admin" ? "Client" : r === "Client" ? null : "Admin"))
          }
          className="fixed right-4 top-4 z-30 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-xl transition hover:bg-black/60"
          style={{
            marginTop: "calc(env(safe-area-inset-top, 0px) + 4px)",
            background:
              effectiveRole === "Admin"
                ? "rgba(251,191,36,0.15)"
                : "rgba(119,255,51,0.15)",
            borderColor:
              effectiveRole === "Admin"
                ? "rgba(251,191,36,0.3)"
                : "rgba(119,255,51,0.3)",
            color: effectiveRole === "Admin" ? "#fbbf24" : "#77ff33",
          }}
          title="Tap to cycle your view (Admin → Client → Reset)"
        >
          {effectiveRole}
          {roleOverride && (
            <span className="ml-1 text-white/50">*</span>
          )}
        </button>
      )}

      {/* Bottom Navbar - only shown when logged in and not hidden */}
      {isLoggedIn && (
      <nav
        key={`nav-${currentUser?.id ?? "anon"}-${sessionId}`}
        className={`fixed bottom-6 left-1/2 z-20 w-[min(92%,560px)] -translate-x-1/2 transition-all duration-300 ${
          hideNav
            ? "pointer-events-none translate-y-32 opacity-0"
            : "translate-y-0 opacity-100"
        }`}
      >
        <div
          className="relative overflow-hidden rounded-3xl border border-white/20 shadow-2xl"
          style={{
            background: "rgba(20, 20, 20, 0.72)",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            boxShadow:
              "0 1px 0 0 rgba(255,255,255,0.1) inset, 0 -8px 32px rgba(0,0,0,0.6)",
          }}
        >
          {/* Top liquid wave */}
          <div className="liquid-wave" style={{ top: -1, bottom: "auto", transform: "rotate(180deg)" }}>
            <svg viewBox="0 0 1200 30" preserveAspectRatio="none">
              <path
                d="M0,15 C200,30 400,0 600,15 C800,30 1000,0 1200,15 L1200,30 L0,30 Z"
                fill="rgba(255,255,255,0.05)"
              />
            </svg>
          </div>
          <ul className="relative grid grid-cols-5 px-3 py-3">
            {tabs.map((t) => {
              const isActive = active === t.id;
              return (
                <li key={t.id} className="flex justify-center">
                  <button
                    onClick={() => setActive(t.id)}
                    className="liquid-nav-item group flex flex-col items-center gap-1 rounded-2xl px-2 py-2"
                    aria-label={t.label}
                  >
                    <span
                      className={`relative grid h-9 w-9 place-items-center rounded-xl transition-all duration-500 ease-out ${
                        isActive
                          ? "bg-white/15 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
                          : "text-white/70"
                      }`}
                    >
                      <span className="liquid-glow rounded-xl" />
                      <span className="relative">{t.icon}</span>
                    </span>
                    <span
                      className={`text-[10px] font-medium tracking-wide transition-colors duration-300 ${
                        isActive ? "text-white" : "text-white/50"
                      }`}
                    >
                      {t.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Bottom liquid wave */}
          <div className="liquid-wave">
            <svg viewBox="0 0 1200 30" preserveAspectRatio="none">
              <path
                 d="M0,15 C200,0 400,30 600,15 C800,0 1000,30 1200,15 L1200,30 L0,30 Z"
                 fill="rgba(255,255,255,0.05)"
               />
             </svg>
           </div>
         </div>
       </nav>
      )}

      {/* Footer - hidden when chat is open, a modal is open, or not logged in */}
      {isLoggedIn && (
        <footer
          key={`footer-${currentUser?.id ?? "anon"}-${sessionId}`}
          className={`pointer-events-none fixed bottom-1 left-0 right-0 z-10 text-center text-[10px] tracking-wide text-white/30 transition-opacity duration-300 ${
            hideNav ? "opacity-0" : "opacity-100"
          }`}
        >
          ©2023 Copyright ICONNECT. All Rights Reserved
        </footer>
      )}
    </div>
  );
}
