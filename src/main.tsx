import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

// Show a friendly fallback screen if the app crashes for any reason
// (e.g. missing Supabase env vars, network errors during init, etc.)
function showFallback(err: unknown) {
  console.error("App failed to start:", err);
  const detail = err instanceof Error ? err.message : String(err);
  if (!root) return;
  root.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      background: #000;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      text-align: center;
    ">
      <div style="max-width: 520px; padding: 32px; border-radius: 20px; background: rgba(255,255,255,0.04); border: 0.5px solid rgba(255,255,255,0.18); backdrop-filter: blur(20px);">
        <div style="font-size: 48px; margin-bottom: 16px;">⚙️</div>
        <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 8px 0;">
          Configuration required
        </h1>
        <p style="font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.7); margin: 0 0 16px 0;">
          The Supabase environment variables are not set.
          Please configure
          <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace;">VITE_SUPABASE_URL</code>
          and
          <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace;">VITE_SUPABASE_ANON_KEY</code>
          in your <strong>Cloudflare Pages environment variables</strong>
          (or in <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace;">.env.local</code> for local dev).
        </p>
        <pre style="
          font-size: 11px;
          background: rgba(0,0,0,0.5);
          padding: 12px;
          border-radius: 8px;
          text-align: left;
          color: rgba(255,150,150,0.9);
          font-family: monospace;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 200px;
          overflow: auto;
        ">${detail.replace(/</g, "&lt;")}</pre>
      </div>
    </div>
  `;
}

// Global error handlers so the page never goes blank
window.addEventListener("error", (e) => showFallback(e.error || e.message));
window.addEventListener("unhandledrejection", (e) =>
  showFallback(e.reason)
);

try {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (err) {
  showFallback(err);
}
