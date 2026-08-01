export default function Home({
  isAdmin = true,
  userName,
  userAvatar,
}: {
  isAdmin?: boolean;
  userName?: string;
  userAvatar?: string;
} = {}) {
  return (
    <div className="space-y-6">
      {/* App name in top-left corner */}
      <div className="-ml-1 -mt-2">
        <h1 className="font-brand brand-text text-5xl font-bold leading-none">
          ICONNECT
        </h1>
      </div>

      <header className="flex items-center justify-between pt-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Welcome</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">
            Hello, {userName || "there"}
          </h2>
          <p
            className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={
              isAdmin
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
            <span
              className="h-1 w-1 rounded-full"
              style={{ background: isAdmin ? "#fbbf24" : "#77ff33" }}
            />
            {isAdmin ? "Admin" : "Client"}
          </p>
        </div>
        <div
          className="liquid-card h-10 w-10 overflow-hidden rounded-full"
          style={
            userAvatar
              ? {
                  backgroundImage: `url(${userAvatar})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
      </header>

      {/* About ICONNECT welcome card */}
      <div className="liquid-card relative overflow-hidden rounded-3xl p-5">
        <div className="flex items-start gap-2">
          <span
            className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: "#77ff33", boxShadow: "0 0 8px #77ff33" }}
          />
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">About ICONNECT</p>
            <h3 className="mt-1 font-display text-lg font-semibold">
              Your all-in-one digital wallet
            </h3>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-white/70">
          <span className="font-brand brand-text text-base">ICONNECT</span> is a
          modern financial companion built to keep your money, payments and
          conversations in one secure place. Track your LKR balance in real
          time, send and receive money instantly, manage your transactions,
          and stay connected with friends and merchants — all from a single,
          beautifully designed app.
        </p>

        <ul className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
          <li className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="#77ff33" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="text-white/80">Instant transfers</span>
          </li>
          <li className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="#77ff33" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="text-white/80">Bank-grade security</span>
          </li>
          <li className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="#77ff33" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="text-white/80">LKR & multi-currency</span>
          </li>
          <li className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="#77ff33" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="text-white/80">24/7 support</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
