import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import React from "react";
import { createPortal } from "react-dom";
import { api, type UiTransaction } from "../lib/api";

export default function Transaction({
  onModalChange,
  isAdmin = true,
}: {
  onModalChange?: Dispatch<SetStateAction<boolean>>;
  isAdmin?: boolean;
}) {
  const [records, setRecords] = useState<UiTransaction[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load transactions from the database for the current user
  useEffect(() => {
    const stored = localStorage.getItem("iconnect:currentUserId");
    if (stored) {
      setCurrentUserId(stored);
      setLoadingRecords(true);
      api
        .listTransactions()
        .then((txs) => setRecords(txs as UiTransaction[]))
        .catch((err) => console.error("Load transactions error:", err))
        .finally(() => setLoadingRecords(false));
    }
  }, []);
  const [showIncoming, setShowIncoming] = useState(false);
  const [showExpense, setShowExpense] = useState(false);

  // Notify parent when any modal is open so it can hide the navbar
  useEffect(() => {
    onModalChange?.(showIncoming || showExpense);
  }, [showIncoming, showExpense, onModalChange]);

  // Incoming form state
  const [incomingForm, setIncomingForm] = useState({
    from: "",
    accountNumber: "",
    fromBank: "",
    senderName: "",
    amount: "",
  });
  const [incomingErrors, setIncomingErrors] = useState<Record<string, string>>({});

  // Expense form state
  const [expenseForm, setExpenseForm] = useState<{
    category: "account" | "expense" | "";
    accountNumber: string;
    expenseReason: string;
    amount: string;
    notes: string;
  }>({
    category: "",
    accountNumber: "",
    expenseReason: "",
    amount: "",
    notes: "",
  });
  const [expenseErrors, setExpenseErrors] = useState<Record<string, string>>({});

  const totalIncoming = records
    .filter((r) => r.type === "incoming")
    .reduce((sum, r) => sum + r.amount, 0);

  const totalExpense = records
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + r.amount, 0);

  const balance = totalIncoming - totalExpense;

  // ===== Incoming submit =====
  const submitIncoming = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!incomingForm.from.trim()) errors.from = "Required";
    if (!incomingForm.fromBank.trim()) errors.fromBank = "Required";
    if (!incomingForm.senderName.trim()) errors.senderName = "Required";
    if (!incomingForm.amount.trim()) errors.amount = "Required";
    else if (isNaN(Number(incomingForm.amount)) || Number(incomingForm.amount) <= 0)
      errors.amount = "Invalid amount";

    if (Object.keys(errors).length > 0) {
      setIncomingErrors(errors);
      return;
    }

    if (!currentUserId) {
      setIncomingErrors({ _root: "Not signed in" });
      return;
    }
    try {
      const newRecord = await api.createTransaction(currentUserId, {
        type: "incoming",
        from: incomingForm.from.trim(),
        accountNumber: incomingForm.accountNumber.trim() || undefined,
        fromBank: incomingForm.fromBank.trim(),
        senderName: incomingForm.senderName.trim(),
        amount: Number(incomingForm.amount),
      });
      setRecords((prev) => [newRecord, ...prev]);
      setIncomingForm({ from: "", accountNumber: "", fromBank: "", senderName: "", amount: "" });
      setIncomingErrors({});
      setShowIncoming(false);
      // Notify the Balance page to refresh
      try {
        window.dispatchEvent(new CustomEvent("iconnect:tx-changed"));
      } catch {}
    } catch (err) {
      console.error("Create transaction error:", err);
      setIncomingErrors({ _root: "Failed to save" });
    }
  };

  // ===== Expense submit =====
  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!expenseForm.category) errors.category = "Required";
    if (expenseForm.category === "account" && !expenseForm.accountNumber.trim())
      errors.accountNumber = "Required";
    if (expenseForm.category === "expense" && !expenseForm.expenseReason.trim())
      errors.expenseReason = "Required";
    if (!expenseForm.amount.trim()) errors.amount = "Required";
    else if (isNaN(Number(expenseForm.amount)) || Number(expenseForm.amount) <= 0)
      errors.amount = "Invalid amount";

    if (Object.keys(errors).length > 0) {
      setExpenseErrors(errors);
      return;
    }

    if (!currentUserId) {
      setExpenseErrors({ _root: "Not signed in" });
      return;
    }
    try {
      const newRecord = await api.createTransaction(currentUserId, {
        type: "expense",
        category: expenseForm.category as "account" | "expense",
        accountNumber:
          expenseForm.category === "account"
            ? expenseForm.accountNumber.trim()
            : undefined,
        expenseReason:
          expenseForm.category === "expense"
            ? expenseForm.expenseReason.trim()
            : undefined,
        amount: Number(expenseForm.amount),
        notes: expenseForm.notes.trim() || undefined,
      });
      setRecords((prev) => [newRecord, ...prev]);
      setExpenseForm({ category: "", accountNumber: "", expenseReason: "", amount: "", notes: "" });
      setExpenseErrors({});
      setShowExpense(false);
      // Notify the Balance page to refresh
      try {
        window.dispatchEvent(new CustomEvent("iconnect:tx-changed"));
      } catch {}
    } catch (err) {
      console.error("Create transaction error:", err);
      setExpenseErrors({ _root: "Failed to save" });
    }
  };

  const fmt = (n: number) =>
    "Rs " + n.toLocaleString("en-LK", { maximumFractionDigits: 0 });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">History</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Transactions</h1>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="liquid-card rounded-2xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/40">In</p>
          <p className="mt-1 text-sm font-semibold" style={{ color: "#77ff33" }}>
            {fmt(totalIncoming)}
          </p>
        </div>
        <div className="liquid-card rounded-2xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Out</p>
          <p className="mt-1 text-sm font-semibold text-rose-300">
            {fmt(totalExpense)}
          </p>
        </div>
        <div className="liquid-card rounded-2xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Net</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {fmt(balance)}
          </p>
        </div>
      </div>

      {/* Two action buttons - admin only (clients can still see balance + history below) */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-3">
          <button
          onClick={() => setShowIncoming(true)}
          className="liquid-card group flex flex-col items-center justify-center gap-2 rounded-2xl p-4 transition hover:bg-white/[0.08]"
          style={{
            borderColor: "rgba(119,255,51,0.3)",
            background: "linear-gradient(135deg, rgba(119,255,51,0.08) 0%, rgba(119,255,51,0.02) 100%)",
          }}
        >
          <div
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{ background: "rgba(119,255,51,0.15)", color: "#77ff33" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M12 5v14" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">Add Incoming</p>
            <p className="text-[10px] text-white/50">Record money in</p>
          </div>
        </button>

        <button
          onClick={() => setShowExpense(true)}
          className="liquid-card group flex flex-col items-center justify-center gap-2 rounded-2xl p-4 transition hover:bg-white/[0.08]"
          style={{
            borderColor: "rgba(255,93,93,0.3)",
            background: "linear-gradient(135deg, rgba(255,93,93,0.08) 0%, rgba(255,93,93,0.02) 100%)",
          }}
        >
          <div
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{ background: "rgba(255,93,93,0.15)", color: "#ff5d5d" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M12 19V5" />
              <path d="M5 12l7 7 7-7" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">Add Expense</p>
            <p className="text-[10px] text-white/50">Record money out</p>
          </div>
        </button>
        </div>
      )}

      {/* Transaction list — visible to everyone */}
      <div className="liquid-card overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-white/40">
            Recent
          </p>
          {!isAdmin && (
            <p className="text-[10px] text-white/40">View only</p>
          )}
        </div>
        {loadingRecords ? (
          <div className="px-4 py-8 text-center text-sm text-white/50">
            <span
              className="mr-2 inline-block h-3 w-3 rounded-full border-2 border-white/30 border-t-white/80"
              style={{ animation: "spin 0.8s linear infinite" }}
            />
            Loading...
          </div>
        ) : records.length === 0 ? (
          <div className="px-4 py-10 text-center">
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
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
              </svg>
            </div>
            <p className="text-sm text-white/60">No transactions yet</p>
            <p className="mt-1 text-[11px] text-white/40">
              {isAdmin
                ? "Add one using the buttons above"
                : "Only admins can add transactions"}
            </p>
          </div>
        ) : (
          records.map((t, i) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-3 fade-in ${
                i !== records.length - 1 ? "border-b border-white/5" : ""
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{
                  background:
                    t.type === "incoming"
                      ? "rgba(119,255,51,0.12)"
                      : "rgba(255,93,93,0.12)",
                  color: t.type === "incoming" ? "#77ff33" : "#ff5d5d",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  {t.type === "incoming" ? (
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  ) : (
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  )}
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {t.type === "incoming" ? t.senderName : t.expenseReason || t.accountNumber}
                </p>
                <p className="truncate text-[11px] text-white/50">
                  {t.type === "incoming" ? `${t.from} • ${t.fromBank}` : t.notes || "Expense"}
                  <span className="mx-1.5">•</span>
                  {t.date} {t.time}
                </p>
              </div>
              <p
                className={`text-sm font-semibold ${
                  t.type === "incoming" ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {t.type === "incoming" ? "+" : "-"} {fmt(t.amount)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Incoming Modal */}
      {showIncoming && (
        <Modal title="Add Incoming Record" onClose={() => setShowIncoming(false)}>
          <form onSubmit={submitIncoming} className="space-y-3 pb-2">
            <Field
              label="From"
              required
              error={incomingErrors.from}
              placeholder="e.g. Salary, Friend, Refund"
              value={incomingForm.from}
              onChange={(v) => setIncomingForm({ ...incomingForm, from: v })}
            />
            <Field
              label="Account Number"
              placeholder="Optional"
              value={incomingForm.accountNumber}
              onChange={(v) => setIncomingForm({ ...incomingForm, accountNumber: v })}
              mono
            />
            <Field
              label="From Bank"
              required
              error={incomingErrors.fromBank}
              placeholder="e.g. BOC, HNB, Sampath"
              value={incomingForm.fromBank}
              onChange={(v) => setIncomingForm({ ...incomingForm, fromBank: v })}
            />
            <Field
              label="Sender Name"
              required
              error={incomingErrors.senderName}
              placeholder="Who sent it"
              value={incomingForm.senderName}
              onChange={(v) => setIncomingForm({ ...incomingForm, senderName: v })}
            />
            <Field
              label="Amount (LKR)"
              required
              error={incomingErrors.amount}
              placeholder="0.00"
              value={incomingForm.amount}
              onChange={(v) => setIncomingForm({ ...incomingForm, amount: v })}
              type="number"
              prefix="Rs"
            />
            <ModalActions
              onCancel={() => setShowIncoming(false)}
              submitLabel="Add Incoming"
              submitColor="#77ff33"
            />
          </form>
        </Modal>
      )}

      {/* Expense Modal */}
      {showExpense && (
        <Modal title="Add Expense Record" onClose={() => setShowExpense(false)}>
          <form onSubmit={submitExpense} className="space-y-3 pb-2">
            {/* Dropdown */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/70">
                Type <span className="text-rose-400">*</span>
              </label>
              <div
                className="relative rounded-xl transition focus-within:bg-white/[0.08]"
                style={{
                  background: "rgba(118, 118, 128, 0.16)",
                  border: expenseErrors.category
                    ? "1px solid rgba(255,93,93,0.6)"
                    : "1px solid transparent",
                  boxShadow: expenseErrors.category
                    ? "0 0 0 3px rgba(255,93,93,0.1)"
                    : "none",
                }}
              >
                <select
                  value={expenseForm.category}
                  onChange={(e) => {
                    setExpenseForm({
                      ...expenseForm,
                      category: e.target.value as "account" | "expense" | "",
                      accountNumber: "",
                      expenseReason: "",
                    });
                    setExpenseErrors({ ...expenseErrors, category: "" });
                  }}
                  className="w-full appearance-none rounded-xl border-0 bg-transparent px-3.5 py-3 pr-10 text-sm text-white outline-none"
                  style={{ color: "#fff" }}
                >
                  <option value="" style={{ background: "#0a0a0a", color: "#fff" }}>
                    Select an option
                  </option>
                  <option value="account" style={{ background: "#0a0a0a", color: "#fff" }}>
                    To Account (transfer to another account)
                  </option>
                  <option value="expense" style={{ background: "#0a0a0a", color: "#fff" }}>
                    Expense (spending)
                  </option>
                </select>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {expenseErrors.category && (
                <p className="mt-1 text-[11px] font-medium" style={{ color: "#ff5d5d" }}>
                  {expenseErrors.category}
                </p>
              )}
            </div>

            {/* Conditional: Account number input */}
            {expenseForm.category === "account" && (
              <Field
                label="Account Number"
                required
                error={expenseErrors.accountNumber}
                placeholder="Recipient account"
                value={expenseForm.accountNumber}
                onChange={(v) => setExpenseForm({ ...expenseForm, accountNumber: v })}
                mono
              />
            )}

            {/* Conditional: Expense reason input */}
            {expenseForm.category === "expense" && (
              <Field
                label="Expense Reason"
                required
                error={expenseErrors.expenseReason}
                placeholder="e.g. Groceries, Transport, Food"
                value={expenseForm.expenseReason}
                onChange={(v) => setExpenseForm({ ...expenseForm, expenseReason: v })}
              />
            )}

            <Field
              label="Amount (LKR)"
              required
              error={expenseErrors.amount}
              placeholder="0.00"
              value={expenseForm.amount}
              onChange={(v) => setExpenseForm({ ...expenseForm, amount: v })}
              type="number"
              prefix="Rs"
            />
            <Field
              label="Notes"
              placeholder="Optional"
              value={expenseForm.notes}
              onChange={(v) => setExpenseForm({ ...expenseForm, notes: v })}
            />
            <ModalActions
              onCancel={() => setShowExpense(false)}
              submitLabel="Add Expense"
              submitColor="#ff5d5d"
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ===== Modal =====
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        animation: "fadeIn 0.2s ease-out",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: "scaleIn 0.3s ease-out",
          background: "rgba(28, 28, 30, 0.78)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          border: "0.5px solid rgba(255,255,255,0.18)",
          boxShadow:
            "0 1px 0 0 rgba(255,255,255,0.1) inset, 0 25px 80px rgba(0,0,0,0.8)",
          maxHeight: "min(90vh, 90dvh, 640px)",
        }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-white/70 transition active:scale-90"
            style={{
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
            }}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto px-5 py-4"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            scrollbarWidth: "thin",
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ===== Form field =====
function Field({
  label,
  required,
  error,
  placeholder,
  value,
  onChange,
  type = "text",
  prefix,
  mono,
}: {
  label: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  prefix?: string;
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
        {prefix && <span className="text-sm text-white/60">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 bg-transparent text-sm text-white outline-none ${
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

// ===== Modal actions =====
function ModalActions({
  onCancel,
  submitLabel,
  submitColor,
}: {
  onCancel: () => void;
  submitLabel: string;
  submitColor: string;
}) {
  return (
    <div
      className="mt-4 flex shrink-0 gap-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]"
      >
        Cancel
      </button>
      <button
        type="submit"
        className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.98]"
        style={{
          background: `linear-gradient(135deg, ${submitColor} 0%, ${submitColor}cc 100%)`,
          boxShadow: `0 4px 14px ${submitColor}55`,
        }}
      >
        {submitLabel}
      </button>
    </div>
  );
}
