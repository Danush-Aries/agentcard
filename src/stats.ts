/**
 * Stats types and the pure aggregation core.
 *
 * The aggregator is decoupled from disk IO: feed it parsed JSONL objects (any
 * shape) via `foldRecord`, then call `finalize`. This makes the math trivially
 * testable with golden fixtures and fuzz inputs.
 */

import { dayKey } from "./format.js";

export interface TokenTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  /** input + output (the "real" tokens the user thinks about). */
  billed: number;
}

export interface ToolCount {
  name: string;
  count: number;
}

export interface Stats {
  tokens: TokenTotals;
  sessionCount: number;
  projectCount: number;
  messageCount: number;
  toolUsage: Record<string, number>;
  toolTotal: number;
  topTools: ToolCount[];
  topTool: ToolCount | null;
  activeDays: number;
  streakDays: number;
  firstActivity: string | null;
  lastActivity: string | null;
  busiestProject: { name: string; sessions: number } | null;
}

export interface Accumulator {
  tokens: TokenTotals;
  messageCount: number;
  toolUsage: Record<string, number>;
  days: Set<string>;
  firstMs: number | null;
  lastMs: number | null;
  projectSessions: Map<string, Set<string>>;
  sessions: Set<string>;
}

export function createAccumulator(): Accumulator {
  return {
    tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, billed: 0 },
    messageCount: 0,
    toolUsage: Object.create(null),
    days: new Set(),
    firstMs: null,
    lastMs: null,
    projectSessions: new Map(),
    sessions: new Set(),
  };
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

/**
 * Fold a single parsed JSONL object into the accumulator. `fallbackProject` /
 * `fallbackSession` are used when the record lacks `cwd` / `sessionId` (the
 * discovery layer knows these from the file path). Malformed records are
 * ignored gracefully.
 */
export function foldRecord(
  acc: Accumulator,
  rec: unknown,
  fallbackProject: string,
  fallbackSession: string,
): void {
  if (!rec || typeof rec !== "object") return;
  const o = rec as Record<string, any>;

  const sessionId: string =
    (typeof o.sessionId === "string" && o.sessionId) || fallbackSession;
  const project: string = projectName(o.cwd) ?? fallbackProject;

  const ts: string | undefined =
    typeof o.timestamp === "string" ? o.timestamp : undefined;
  if (ts) {
    const ms = Date.parse(ts);
    if (!Number.isNaN(ms)) {
      acc.firstMs = acc.firstMs === null ? ms : Math.min(acc.firstMs, ms);
      acc.lastMs = acc.lastMs === null ? ms : Math.max(acc.lastMs, ms);
      const dk = dayKey(ts);
      if (dk) acc.days.add(dk);
    }
    registerSession(acc, project, sessionId);
  }

  if (o.type !== "assistant" || !o.message || typeof o.message !== "object") {
    return;
  }
  const msg = o.message as Record<string, any>;
  acc.messageCount++;
  registerSession(acc, project, sessionId);

  const u = msg.usage;
  if (u && typeof u === "object") {
    acc.tokens.input += num(u.input_tokens);
    acc.tokens.output += num(u.output_tokens);
    acc.tokens.cacheRead += num(u.cache_read_input_tokens);
    acc.tokens.cacheCreation += num(u.cache_creation_input_tokens);
  }

  const content = msg.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === "object" && block.type === "tool_use") {
        const name = typeof block.name === "string" ? block.name : "unknown";
        acc.toolUsage[name] = (acc.toolUsage[name] || 0) + 1;
      }
    }
  }
}

function registerSession(acc: Accumulator, project: string, sessionId: string) {
  acc.sessions.add(sessionId);
  let set = acc.projectSessions.get(project);
  if (!set) {
    set = new Set();
    acc.projectSessions.set(project, set);
  }
  set.add(sessionId);
}

/** Derive a friendly project name from a cwd path. */
export function projectName(cwd: unknown): string | null {
  if (typeof cwd !== "string" || cwd.length === 0) return null;
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : cwd;
}

/**
 * Longest run of consecutive UTC days present in the set. Deterministic and
 * independent of "today", so golden tests stay stable forever.
 */
export function longestStreak(days: Set<string>): number {
  if (days.size === 0) return 0;
  const sorted = [...days].sort();
  let best = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = Date.parse(sorted[i - 1] + "T00:00:00Z");
    const cur = Date.parse(sorted[i] + "T00:00:00Z");
    const diffDays = Math.round((cur - prev) / 86_400_000);
    if (diffDays === 1) { run++; best = Math.max(best, run); }
    else if (diffDays > 1) { run = 1; }
  }
  return best;
}

export function finalize(acc: Accumulator): Stats {
  acc.tokens.billed = acc.tokens.input + acc.tokens.output;

  const toolUsage: Record<string, number> = {};
  for (const k of Object.keys(acc.toolUsage)) toolUsage[k] = acc.toolUsage[k];

  const topTools: ToolCount[] = Object.entries(toolUsage)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const toolTotal = topTools.reduce((s, t) => s + t.count, 0);

  let busiest: { name: string; sessions: number } | null = null;
  for (const [name, set] of acc.projectSessions) {
    if (!busiest || set.size > busiest.sessions) busiest = { name, sessions: set.size };
  }

  return {
    tokens: acc.tokens,
    sessionCount: acc.sessions.size,
    projectCount: acc.projectSessions.size,
    messageCount: acc.messageCount,
    toolUsage,
    toolTotal,
    topTools,
    topTool: topTools[0] ?? null,
    activeDays: acc.days.size,
    streakDays: longestStreak(acc.days),
    firstActivity: acc.firstMs === null ? null : new Date(acc.firstMs).toISOString(),
    lastActivity: acc.lastMs === null ? null : new Date(acc.lastMs).toISOString(),
    busiestProject: busiest,
  };
}
