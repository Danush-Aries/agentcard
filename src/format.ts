/**
 * Pure formatting helpers. No side effects — safe to unit test in isolation.
 */

/** Format a token/count number compactly: 2400000 -> "2.4M", 12500 -> "12.5K". */
export function humanNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return trimZero(n / 1000, n / 1000 < 100 ? 1 : 0) + "K";
  if (n < 1_000_000_000) return trimZero(n / 1e6, n / 1e6 < 100 ? 1 : 0) + "M";
  return trimZero(n / 1e9, n / 1e9 < 100 ? 1 : 0) + "B";
}

function trimZero(v: number, digits: number): string {
  return v.toFixed(digits).replace(/\.0+$/, "");
}

/** Plain thousands separator: 1234567 -> "1,234,567". */
export function withCommas(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** ISO timestamp -> UTC day string "YYYY-MM-DD". Returns null on invalid input. */
export function dayKey(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Human date like "Jun 13, 2026" (UTC). */
export function prettyDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  });
}

/** Escape a string for safe inclusion in SVG/XML text nodes and attributes. */
export function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Shorten a tool name for display (strip mcp__ prefixes to the leaf). */
export function shortToolName(name: string): string {
  if (name.startsWith("mcp__")) {
    const parts = name.split("__");
    return parts[parts.length - 1] || name;
  }
  return name;
}
