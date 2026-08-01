// Format an ISO date string or short token into friendly relative time.
// Examples:
//   new Date().toISOString()  ->  "Just now" / "5m ago" / "2h ago" / "Yesterday"
//   "2026-08-01T10:17:32.033Z" ->  "5m ago"
//   "Now" / "Today" / "5m"        ->  passed through as-is
export function formatRelativeTime(input: string | undefined | null): string {
  if (!input) return "";
  const trimmed = String(input).trim();

  // Short tokens that are already friendly — return as-is
  if (
    /^(Now|Today|Yesterday|\d+\s*(m|h|d|w)\s*ago|\d+[mhdw])$/i.test(trimmed)
  ) {
    return trimmed;
  }

  // Try to parse as ISO date or any other valid date string
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    // Can't parse — return as-is
    return trimmed;
  }

  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);

  // Future timestamps show "Just now"
  if (diffSec < 0) return "Just now";

  // Less than a minute ago
  if (diffSec < 60) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  // Less than an hour
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  // Less than a day
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  // Yesterday
  if (diffDay === 1) return "Yesterday";
  // Within a week
  if (diffDay < 7) return `${diffDay}d ago`;

  // Within a few weeks
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 4) return `${diffWk}w ago`;

  // Older — show a short date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}
