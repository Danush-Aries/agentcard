#!/usr/bin/env node
/**
 * agentcard CLI.
 *
 *   npx agentcard             scan ~/.claude/projects, write agentcard.svg
 *   npx agentcard --demo      render from bundled sample logs (no real logs needed)
 *   npx agentcard --theme neon --out card.svg --name "Dhanush"
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { collectStats, collectFromFiles } from "./collect.js";
import { discoverLogFiles, defaultLogRoot } from "./parser.js";
import { renderCard } from "./render.js";
import { THEME_NAMES } from "./themes.js";
import { humanNumber, withCommas, shortToolName, prettyDate } from "./format.js";
import type { Stats } from "./stats.js";

interface Args {
  theme: string;
  out: string;
  demo: boolean;
  name?: string;
  dir?: string;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { theme: "dark", out: "agentcard.svg", demo: false, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--demo": a.demo = true; break;
      case "--theme": case "-t": a.theme = next() ?? a.theme; break;
      case "--out": case "-o": a.out = next() ?? a.out; break;
      case "--name": case "-n": a.name = next(); break;
      case "--dir": case "-d": a.dir = next(); break;
      case "--help": case "-h": a.help = true; break;
      case "--version": case "-v": a.version = true; break;
      default:
        if (arg.startsWith("--theme=")) a.theme = arg.slice(8);
        else if (arg.startsWith("--out=")) a.out = arg.slice(6);
        else if (arg.startsWith("--name=")) a.name = arg.slice(7);
        else if (arg.startsWith("--dir=")) a.dir = arg.slice(6);
    }
  }
  return a;
}

function help(): string {
  return `
  agentcard — github-readme-stats, but for AI pair-programming.

  Reads your real local Claude Code logs and renders an embeddable SVG stat card.

  Usage
    npx agentcard [options]

  Options
    --demo              render from bundled sample logs (no real logs, 100% offline)
    -t, --theme <name>  ${THEME_NAMES.join(" | ")}   (default: dark)
    -o, --out <file>    output path (default: agentcard.svg)
    -n, --name <name>   name shown on the card
    -d, --dir <path>    override log directory (default: ~/.claude/projects)
    -h, --help          show this help
    -v, --version       print version

  Privacy: everything runs locally. Only aggregate numbers are rendered —
  no prompts, code, or file contents ever leave your machine.
`;
}

function bundledDemoDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/cli.js -> ../assets/demo ; also works from src via ../assets/demo
  return resolve(here, "..", "assets", "demo");
}

function summaryLine(stats: Stats): string {
  const parts = [
    `${humanNumber(stats.tokens.billed)} tokens`,
    `${withCommas(stats.sessionCount)} sessions`,
    stats.topTool ? `top tool: ${shortToolName(stats.topTool.name)}` : null,
    `${stats.streakDays}-day streak`,
  ].filter(Boolean);
  return parts.join(" · ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(help() + "\n"); return; }
  if (args.version) {
    process.stdout.write("agentcard 1.0.0\n");
    return;
  }

  let stats: Stats;
  let source: string;

  if (args.demo) {
    const dir = bundledDemoDir();
    const files = await discoverLogFiles(dir);
    stats = await collectFromFiles(files);
    source = `bundled demo (${files.length} sample sessions)`;
  } else {
    const root = args.dir ?? defaultLogRoot();
    const res = await collectStats(root);
    stats = res.stats;
    source = `${res.fileCount} transcripts in ${root}`;
    if (res.fileCount === 0) {
      process.stderr.write(
        `\n  No Claude Code logs found in ${root}\n` +
        `  Try a real Claude Code session first, or run: npx agentcard --demo\n\n`,
      );
      process.exitCode = 1;
      return;
    }
  }

  const svg = renderCard(stats, {
    theme: args.theme,
    name: args.name,
  });

  const outPath = resolve(process.cwd(), args.out);
  await writeFile(outPath, svg, "utf8");

  const rel = args.out;
  const embed =
    `[![My Claude Code stats](./${rel})](https://github.com/Danush-Aries/agentcard)`;

  process.stdout.write(
    `\n  ⚡ agentcard\n\n` +
    `  Source : ${source}\n` +
    `  Theme  : ${args.theme}\n` +
    `  Range  : ${prettyDate(stats.firstActivity)} → ${prettyDate(stats.lastActivity)}\n` +
    `  Stats  : ${summaryLine(stats)}\n\n` +
    `  Wrote  : ${outPath}\n\n` +
    `  Paste this into your profile README:\n\n` +
    `  ${embed}\n\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`agentcard: ${err?.message ?? err}\n`);
  process.exitCode = 1;
});
