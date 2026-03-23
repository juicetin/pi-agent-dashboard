/**
 * Formatting utilities for session card display.
 */

/** Format token count: 12400 → "12.4k", 500 → "500" */
export function formatTokens(value: number): string {
  if (!value || isNaN(value)) return "0";
  if (value < 1000) return String(value);
  const k = value / 1000;
  return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
}

/** Format millisecond duration to relative time: 180000 → "3m" */
export function formatRelativeTime(ms: number): string {
  if (ms <= 0) return "0s";

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}
