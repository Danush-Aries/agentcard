/**
 * SVG card renderer. Produces a deterministic, self-contained SVG string
 * (safe to embed directly in a GitHub README via <img>).
 *
 * IMPORTANT: every element is fully visible in its resting CSS state. The only
 * animation is a bolt "pulse" that oscillates opacity within a visible range —
 * so the card looks correct even in renderers that ignore CSS animations
 * (GitHub camo, social-preview rasterizers, qlmanage, etc.).
 */

import { Stats } from "./stats.js";
import { Theme, resolveTheme } from "./themes.js";
import {
  humanNumber, withCommas, prettyDate, escapeXml, shortToolName,
} from "./format.js";

export interface RenderOptions {
  theme?: string;
  name?: string;
  /** Repo/footer link the "agentcard" wordmark points to (self-propagation). */
  footerUrl?: string;
  /** Max tools shown in the histogram. */
  maxTools?: number;
}

const W = 500;
const H = 215;
export const FOOTER_URL = "https://github.com/Danush-Aries/agentcard";

export function renderCard(stats: Stats, opts: RenderOptions = {}): string {
  const t = resolveTheme(opts.theme);
  const name = (opts.name ?? "").trim();
  const footerUrl = opts.footerUrl ?? FOOTER_URL;
  const maxTools = Math.max(1, Math.min(opts.maxTools ?? 5, 8));

  const title = name ? `${name}'s Claude Code` : "Claude Code Activity";

  const metrics: Array<[string, string, string]> = [
    [humanNumber(stats.tokens.billed), "tokens", t.accent],
    [withCommas(stats.sessionCount), "sessions", t.text],
    [`${stats.streakDays}`, "day streak", t.accent2],
    [`${stats.activeDays}`, "active days", t.text],
  ];

  const dateRange =
    stats.firstActivity && stats.lastActivity
      ? `${prettyDate(stats.firstActivity)} → ${prettyDate(stats.lastActivity)}`
      : "no activity yet";

  const topTool = stats.topTool ? shortToolName(stats.topTool.name) : "—";
  const busiest = stats.busiestProject ? stats.busiestProject.name : "—";

  return [
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(title)}: ${withCommas(stats.tokens.billed)} tokens, ${stats.sessionCount} sessions">`,
    defs(t),
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="url(#bg)" stroke="${t.border}" stroke-width="1"${t.glow ? ' filter="url(#glow)"' : ""}/>`,
    header(t, title, topTool, busiest),
    `<line x1="24" y1="66" x2="${W - 24}" y2="66" stroke="${t.border}" stroke-width="1"/>`,
    metricsBlock(t, metrics),
    toolsBlock(t, stats, maxTools),
    footer(t, footerUrl, dateRange),
    `</svg>`,
  ].join("\n");
}

function defs(t: Theme): string {
  const glow = t.glow
    ? `<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
    : "";
  return `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${t.cardFrom}"/>
    <stop offset="100%" stop-color="${t.cardTo}"/>
  </linearGradient>
  <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${t.accent}"/>
    <stop offset="100%" stop-color="${t.accent2}"/>
  </linearGradient>
  ${glow}
  <style>
    .t{font-family:${t.fontStack};}
    /* Pulse only oscillates within a visible range — never hides content. */
    .pulse{animation:pulse 2.4s ease-in-out infinite;}
    @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.55;}}
  </style>
</defs>`;
}

function bolt(x: number, y: number, color: string, pulse = false): string {
  return `<path${pulse ? ' class="pulse"' : ""} transform="translate(${x},${y})" d="M9 0 L1 9 L7 9 L5 16 L14 6 L8 6 Z" fill="${color}"/>`;
}

function header(t: Theme, title: string, topTool: string, busiest: string): string {
  return `<g>
  ${bolt(26, 26, t.accent, true)}
  <text x="48" y="40" class="t" font-size="18" font-weight="700" fill="${t.title}">${escapeXml(title)}</text>
  <text x="${W - 24}" y="30" text-anchor="end" class="t" font-size="11" fill="${t.sub}">top tool · ${escapeXml(topTool)}</text>
  <text x="${W - 24}" y="46" text-anchor="end" class="t" font-size="11" fill="${t.sub}">busiest · ${escapeXml(busiest)}</text>
</g>`;
}

function metricsBlock(t: Theme, metrics: Array<[string, string, string]>): string {
  // 2x2 grid so all four metrics fit above the footer.
  const cols = [28, 118];
  const rowsY = [104, 156];
  return metrics
    .map(([val, label, color], i) => {
      const x = cols[i % 2];
      const y = rowsY[Math.floor(i / 2)];
      return `<g>
    <text x="${x}" y="${y}" class="t" font-size="21" font-weight="800" fill="${color}">${escapeXml(val)}</text>
    <text x="${x}" y="${y + 15}" class="t" font-size="10.5" fill="${t.sub}">${escapeXml(label)}</text>
  </g>`;
    })
    .join("\n");
}

function toolsBlock(t: Theme, stats: Stats, maxTools: number): string {
  const barX = 210;
  const barMax = 240;
  const top = stats.topTools.slice(0, maxTools);
  const heading = `<text x="${barX}" y="90" class="t" font-size="12" font-weight="700" fill="${t.title}">Tool usage</text>`;
  if (top.length === 0) {
    return `${heading}\n<text x="${barX}" y="112" class="t" font-size="11" fill="${t.sub}">no tool calls recorded</text>`;
  }
  const max = top[0].count || 1;
  let y = 104;
  const bars = top
    .map((tool) => {
      const w = Math.max(6, Math.round((tool.count / max) * barMax));
      const label = shortToolName(tool.name);
      const g = `<g>
    <text x="${barX}" y="${y - 2}" class="t" font-size="10.5" fill="${t.text}">${escapeXml(label)}</text>
    <text x="${barX + barMax}" y="${y - 2}" text-anchor="end" class="t" font-size="10.5" fill="${t.sub}">${withCommas(tool.count)}</text>
    <rect x="${barX}" y="${y + 2}" width="${barMax}" height="6" rx="3" fill="${t.track}"/>
    <rect x="${barX}" y="${y + 2}" width="${w}" height="6" rx="3" fill="url(#bar)"/>
  </g>`;
      y += 21;
      return g;
    })
    .join("\n");
  return `${heading}\n${bars}`;
}

function footer(t: Theme, url: string, dateRange: string): string {
  return `<g>
  ${bolt(26, H - 21, t.accent, true)}
  <a href="${escapeXml(url)}" target="_blank" rel="noopener">
    <text x="40" y="${H - 9}" class="t" font-size="11" font-weight="700" fill="${t.accent}">agentcard</text>
  </a>
  <text x="112" y="${H - 9}" class="t" font-size="10" fill="${t.sub}">· 100% local, nothing leaves your machine</text>
  <text x="${W - 24}" y="${H - 9}" text-anchor="end" class="t" font-size="10" fill="${t.sub}">${escapeXml(dateRange)}</text>
</g>`;
}
