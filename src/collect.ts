/** High-level orchestration: discover logs on disk and aggregate into Stats. */

import { Stats, createAccumulator, finalize } from "./stats.js";
import {
  DiscoveredFile, discoverLogFiles, defaultLogRoot, foldFile,
} from "./parser.js";

export interface CollectResult {
  stats: Stats;
  fileCount: number;
  root: string;
}

/** Scan `root` (default ~/.claude/projects) and produce aggregate stats. */
export async function collectStats(root = defaultLogRoot()): Promise<CollectResult> {
  const files = await discoverLogFiles(root);
  const stats = await collectFromFiles(files);
  return { stats, fileCount: files.length, root };
}

/** Aggregate a specific list of discovered files (used by demo + tests). */
export async function collectFromFiles(files: DiscoveredFile[]): Promise<Stats> {
  const acc = createAccumulator();
  for (const f of files) {
    await foldFile(acc, f);
  }
  return finalize(acc);
}
