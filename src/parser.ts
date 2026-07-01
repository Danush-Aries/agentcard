/**
 * Log discovery + resilient JSONL parsing.
 *
 * Design goals:
 *  - Never throw on malformed / partial / truncated lines — skip and continue.
 *  - Stream files line-by-line so a multi-hundred-MB projects dir stays cheap.
 *  - Keep the pure `parseLine` helper trivially fuzz-testable.
 */

import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Accumulator, foldRecord } from "./stats.js";

/** Default location of Claude Code transcripts. */
export function defaultLogRoot(): string {
  return join(homedir(), ".claude", "projects");
}

export interface DiscoveredFile {
  path: string;
  project: string;
  session: string;
}

/**
 * Recursively find every *.jsonl transcript under `root`. Returns [] if the
 * directory does not exist rather than throwing.
 */
export async function discoverLogFiles(root: string): Promise<DiscoveredFile[]> {
  const out: DiscoveredFile[] = [];
  await walk(root, out);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

async function walk(dir: string, out: DiscoveredFile[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, out);
    } else if (e.isFile() && e.name.endsWith(".jsonl")) {
      out.push({
        path: full,
        project: decodeProjectDir(dir),
        session: e.name.replace(/\.jsonl$/, ""),
      });
    }
  }
}

/** `-Users-danu-Desktop-Pentesting` -> `Pentesting` (best-effort fallback). */
export function decodeProjectDir(dir: string): string {
  const base = dir.split(/[\\/]/).filter(Boolean).pop() ?? dir;
  const segs = base.replace(/^-+/, "").split("-").filter(Boolean);
  return segs.length ? segs[segs.length - 1] : base;
}

/**
 * Parse one JSONL line. Returns the object, or `null` for blank/malformed
 * input. Guards against pathologically huge lines to avoid pinning memory.
 */
export function parseLine(line: string, maxLen = 16 * 1024 * 1024): unknown {
  if (line.length === 0) return null;
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLen) return null;
  if (trimmed[0] !== "{" && trimmed[0] !== "[") return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/** Stream a single file into the accumulator. Per-line errors are swallowed. */
export async function foldFile(acc: Accumulator, file: DiscoveredFile): Promise<void> {
  let stream;
  try {
    stream = createReadStream(file.path, { encoding: "utf8" });
  } catch {
    return;
  }
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      const rec = parseLine(line);
      if (rec !== null) foldRecord(acc, rec, file.project, file.session);
    }
  } catch {
    // truncated read / IO hiccup — keep whatever we folded so far
  } finally {
    rl.close();
    stream.destroy();
  }
}

/** True if a path exists and is a directory. */
export async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}
