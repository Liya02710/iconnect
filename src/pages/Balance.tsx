import { useEffect, useState } from "react";
import { api, type UiTransaction } from "../lib/api";

export default function Balance({ isAdmin = true }: { isAdmin?: boolean } = {}) {
  // Current month data — loaded from the database for the current user
  const [monthly, setMonthly] = useState({
    income: 0,
    outgoing: 0,
    balance: 0,
  });
  const [loading, setLoading] = useState(false);
  const [spark, setSpark] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  // Load real transactions from the database
  // Re-fetches when triggered by a `iconnect:tx-changed` event so
  // adding a new transaction on the Transactions page updates the
  // chart here in real-time.
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const stored = localStorage.getItem("iconnect:currentUserId");
    if (!stored) return;
    setLoading(true);
    api
      .listTransactions(stored)
      .then((txs: UiTransaction[]) => {
        // Compute totals (sum all income and expenses for this user)
        const income = txs
          .filter((t) => t.type === "incoming")
          .reduce((sum, t) => sum + t.amount, 0);
        const outgoing = txs
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + t.amount, 0);
        const balance = income - outgoing;
        setMonthly({ income, outgoing, balance });

        // Build a sparkline: cumulative running balance over time
        if (txs.length > 0) {
          let running = 0;
          const series: number[] = [];
          const sorted = [...txs].sort((a, b) => a.id - b.id);
          sorted.forEach((t) => {
            running += t.type === "incoming" ? t.amount : -t.amount;
            series.push(running);
          });
          while (series.length < 13) series.unshift(0);
          setSpark(series.slice(-13));
        } else {
          setSpark([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        }
      })
      .catch((err) => console.error("Load balance error:", err))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Listen for a custom event so the chart refreshes when a new
  // transaction is added (e.g. on the Transaction page)
  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener("iconnect:tx-changed", handler);
    return () => window.removeEventListener("iconnect:tx-changed", handler);
  }, []);

  const hasData = monthly.income > 0 || monthly.outgoing > 0;

  // Smooth bar grow animation
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(t);
  }, []);

  const max = Math.max(
    monthly.income,
    monthly.outgoing,
    Math.abs(monthly.balance),
    1
  );
  const incomeH = (monthly.income / max) * 100;
  const outgoingH = (monthly.outgoing / max) * 100;
  const balanceH = (Math.abs(monthly.balance) / max) * 100;

  const fmt = (n: number) =>
    "Rs " + n.toLocaleString("en-LK", { maximumFractionDigits: 0 });

  // Sparkline data (this month, day-by-day running balance)
  // When no data, use a flat line at 0
  // (spark is loaded by the useEffect above)
  const sparkMax = Math.max(...spark);
  const sparkPath = spark
    .map((v, i) => {
      const x = (i / (spark.length - 1)) * 100;
      const y = 100 - (v / sparkMax) * 100;
      return `${i === 0 ? "M" : "L"} ${x},${y}`;
    })
    .join(" ");
  const sparkArea = `${sparkPath} L 100,100 L 0,100 Z`;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Wallet</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Balance</h1>
        </div>
        <p
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={
            isAdmin
              ? { background: "rgba(251,191,36,0.15)", color: "#fbbf24" }
              : { background: "rgba(119,255,51,0.15)", color: "#77ff33" }
          }
        >
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: isAdmin ? "#fbbf24" : "#77ff33" }}
          />
          {isAdmin ? "Admin" : "Client"}
        </p>
      </header>

      {/* Total balance card */}
      <div className="liquid-card rounded-3xl p-6">
        <p className="text-xs uppercase tracking-widest text-white/60">
          Total balance
        </p>
        <p className="mt-1 text-4xl font-bold">
          {loading ? (
            <span
              className="inline-block h-9 w-9 rounded-full border-2 border-white/30 border-t-white/80"
              style={{ animation: "spin 0.8s linear infinite" }}
            />
          ) : (
            fmt(monthly.balance)
          )}
        </p>
        <p className="mt-2 text-xs text-white/50">
          {loading
            ? "Loading…"
            : hasData
            ? `${monthly.balance >= 0 ? "+" : ""} ${fmt(monthly.balance)} this month`
            : "No transactions yet"}
        </p>

        {/* Sparkline trend */}
        <div className="mt-5 h-20 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <defs>
              <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(119,255,51,0.45)" />
                <stop offset="100%" stopColor="rgba(119,255,51,0)" />
              </linearGradient>
            </defs>
            <path
              d={sparkArea}
              fill="url(#sparkFill)"
              className="transition-all duration-1000"
              style={{
                transformOrigin: "center",
                animation: animate ? "fadeUp 0.9s ease-out both" : "none",
              }}
            />
            <path
              d={sparkPath}
              fill="none"
              stroke="#77ff33"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 300,
                strokeDashoffset: animate ? 0 : 300,
                transition: "stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          </svg>
        </div>
      </div>

      {/* Current month chart card */}
      <div className="liquid-card rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">
              This month
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold">
              Income vs Outgoing
            </h3>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider"
            style={{
              background: "rgba(119,255,51,0.12)",
              color: "#77ff33",
            }}
          >
            {new Date().toLocaleString("en-US", { month: "long" })}
          </span>
        </div>

        {/* Empty state — show only if no data */}
        {!hasData ? (
          <div className="mt-6 flex h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-white/5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-white/40"
              >
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
              </svg>
            </div>
            <p className="text-sm text-white/60">No transactions this month</p>
            <p className="mt-1 text-[11px] text-white/40">
              Add an incoming or expense record to see your chart
            </p>
          </div>
        ) : (
          <>
        {/* Animated bar chart */}
        <div className="mt-6 flex h-44 items-end justify-around gap-4">
          {/* Income */}
          <div className="flex w-20 flex-col items-center gap-2">
            <span className="text-[10px] font-semibold tracking-wide text-white/70">
              {fmt(monthly.income)}
            </span>
            <div className="relative h-32 w-full overflow-hidden rounded-xl bg-white/[0.04]">
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-xl"
                style={{
                  height: animate ? `${incomeH}%` : "0%",
                  background:
                    "linear-gradient(180deg, #77ff33 0%, rgba(119,255,51,0.45) 100%)",
                  boxShadow: "0 -8px 24px rgba(119,255,51,0.35)",
                  transition:
                    "height 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.2s",
                }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "#77ff33" }}
              />
              <span className="text-[11px] font-medium text-white/60">
                Income
              </span>
            </div>
          </div>

          {/* Outgoing */}
          <div className="flex w-20 flex-col items-center gap-2">
            <span className="text-[10px] font-semibold tracking-wide text-white/70">
              {fmt(monthly.outgoing)}
            </span>
            <div className="relative h-32 w-full overflow-hidden rounded-xl bg-white/[0.04]">
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-xl"
                style={{
                  height: animate ? `${outgoingH}%` : "0%",
                  background:
                    "linear-gradient(180deg, #ff5d5d 0%, rgba(255,93,93,0.45) 100%)",
                  boxShadow: "0 -8px 24px rgba(255,93,93,0.35)",
                  transition:
                    "height 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.45s",
                }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "#ff5d5d" }}
              />
              <span className="text-[11px] font-medium text-white/60">
                Outgoing
              </span>
            </div>
          </div>

          {/* Current balance */}
          <div className="flex w-20 flex-col items-center gap-2">
            <span
              className="text-[10px] font-semibold tracking-wide"
              style={{ color: "#77ff33" }}
            >
              {fmt(monthly.balance)}
            </span>
            <div className="relative h-32 w-full overflow-hidden rounded-xl bg-white/[0.04]">
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-xl"
                style={{
                  height: animate ? `${balanceH}%` : "0%",
                  background:
                    "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.3) 100%)",
                  boxShadow: "0 -8px 24px rgba(255,255,255,0.25)",
                  transition:
                    "height 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.7s",
                }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "#ffffff" }}
              />
              <span className="text-[11px] font-medium text-white/60">
                Balance
              </span>
            </div>
          </div>
        </div>

        {/* Summary row */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/5 pt-4 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Income
            </p>
            <p
              className="mt-1 text-sm font-semibold"
              style={{ color: "#77ff33" }}
            >
              {fmt(monthly.income)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Outgoing
            </p>
            <p className="mt-1 text-sm font-semibold text-rose-300">
              {fmt(monthly.outgoing)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">
               Net
             </p>
             <p className="mt-1 text-sm font-semibold text-white">
               {fmt(monthly.balance)}
             </p>
           </div>
         </div>
        </>
        )}
       </div>

      {/* Multi-currency grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { k: "LKR", v: "Rs 0" },
          { k: "USD", v: "$ 0" },
          { k: "EUR", v: "€ 0" },
          { k: "GBP", v: "£ 0" },
        ].map((c) => (
          <div key={c.k} className="liquid-card rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              {c.k}
            </p>
            <p className="mt-1 text-lg font-semibold">{c.v}</p>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
