/** Color themes for the card renderer. All values are plain hex/CSS strings. */

export interface Theme {
  name: string;
  bg: string;
  cardFrom: string;
  cardTo: string;
  border: string;
  title: string;
  text: string;
  sub: string;
  accent: string;
  accent2: string;
  track: string;
  fontStack: string;
  glow: boolean;
}

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO =
  "'SF Mono','JetBrains Mono','Fira Code',Menlo,Consolas,'Courier New',monospace";

export const THEMES: Record<string, Theme> = {
  dark: {
    name: "dark", bg: "#0d1117", cardFrom: "#161b22", cardTo: "#0d1117",
    border: "#30363d", title: "#e6edf3", text: "#c9d1d9", sub: "#8b949e",
    accent: "#58a6ff", accent2: "#bc8cff", track: "#21262d", fontStack: SANS, glow: false,
  },
  light: {
    name: "light", bg: "#ffffff", cardFrom: "#ffffff", cardTo: "#f6f8fa",
    border: "#d0d7de", title: "#1f2328", text: "#1f2328", sub: "#656d76",
    accent: "#0969da", accent2: "#8250df", track: "#eaeef2", fontStack: SANS, glow: false,
  },
  neon: {
    name: "neon", bg: "#0a0118", cardFrom: "#160b2e", cardTo: "#05010f",
    border: "#7b2ff7", title: "#f5e9ff", text: "#e5d5ff", sub: "#a892d6",
    accent: "#ff2e97", accent2: "#00e5ff", track: "#241242", fontStack: SANS, glow: true,
  },
  terminal: {
    name: "terminal", bg: "#000000", cardFrom: "#020a04", cardTo: "#000000",
    border: "#0f3d22", title: "#39ff14", text: "#33ff99", sub: "#1f9e5c",
    accent: "#39ff14", accent2: "#00ffcc", track: "#07240f", fontStack: MONO, glow: true,
  },
};

export const THEME_NAMES = Object.keys(THEMES);

export function resolveTheme(name: string | undefined): Theme {
  if (!name) return THEMES.dark;
  return THEMES[name.toLowerCase()] ?? THEMES.dark;
}
