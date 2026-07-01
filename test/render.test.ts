import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { discoverLogFiles } from "../src/parser.js";
import { collectFromFiles } from "../src/collect.js";
import { renderCard } from "../src/render.js";
import { THEME_NAMES } from "../src/themes.js";
import type { Stats } from "../src/stats.js";

const here = dirname(fileURLToPath(import.meta.url));
const demoDir = resolve(here, "..", "assets", "demo");

async function demoStats(): Promise<Stats> {
  const files = await discoverLogFiles(demoDir);
  return collectFromFiles(files);
}

describe("bundled demo aggregation", () => {
  it("produces the expected headline numbers", async () => {
    const s = await demoStats();
    expect(s.tokens.billed).toBe(2_400_000);
    expect(s.tokens.input).toBe(1_850_000);
    expect(s.tokens.output).toBe(550_000);
    expect(s.sessionCount).toBe(7);
    expect(s.topTool?.name).toBe("Edit");
    expect(s.toolUsage.Edit).toBe(128);
    expect(s.streakDays).toBe(6);
    expect(s.activeDays).toBe(7);
    expect(s.busiestProject?.name).toBe("agentcard");
  });
});

describe("SVG renderer", () => {
  it("renders a well-formed, self-contained SVG", async () => {
    const svg = renderCard(await demoStats(), { theme: "dark", name: "Dhanush" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('width="500"');
    expect(svg).toContain("2.4M");
    expect(svg).toContain("Dhanush");
    expect(svg).toContain("Edit");
  });

  it("always embeds the self-propagating agentcard footer link", async () => {
    const svg = renderCard(await demoStats(), { theme: "dark" });
    expect(svg).toContain(">agentcard<");
    expect(svg).toContain("github.com/Danush-Aries/agentcard");
  });

  it("is deterministic — same stats render byte-identical SVG", async () => {
    const s = await demoStats();
    expect(renderCard(s, { theme: "neon", name: "X" })).toBe(
      renderCard(s, { theme: "neon", name: "X" }),
    );
  });

  it("supports every theme preset", async () => {
    const s = await demoStats();
    expect(THEME_NAMES).toEqual(["dark", "light", "neon", "terminal"]);
    for (const theme of THEME_NAMES) {
      const svg = renderCard(s, { theme });
      expect(svg).toContain("<svg");
      expect(svg.length).toBeGreaterThan(1000);
    }
  });

  it("falls back to the dark theme for unknown theme names", async () => {
    const s = await demoStats();
    expect(renderCard(s, { theme: "does-not-exist" })).toBe(renderCard(s, { theme: "dark" }));
  });

  it("golden snapshot: dark theme", async () => {
    const svg = renderCard(await demoStats(), { theme: "dark", name: "Dhanush" });
    await expect(svg).toMatchFileSnapshot("./__snapshots__/demo-dark.svg");
  });

  it("golden snapshot: terminal theme", async () => {
    const svg = renderCard(await demoStats(), { theme: "terminal", name: "Dhanush" });
    await expect(svg).toMatchFileSnapshot("./__snapshots__/demo-terminal.svg");
  });

  it("handles an empty dataset gracefully", async () => {
    const empty = await collectFromFiles([]);
    const svg = renderCard(empty, { theme: "dark" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("no tool calls recorded");
  });
});
