export type ToD =
  | "dawn"
  | "morning"
  | "noon"
  | "afternoon"
  | "dusk"
  | "night"
  | "deep";

export type Palette = {
  bgA: string;
  bgB: string;
  fg: string;
  fgSoft: string;
  rule: string;
  glass: string;
  glassBd: string;
  glassHl: string;
  glassSh: string;
  orb1: string;
  orb2: string;
};

export const TOD: Record<ToD, Palette> = {
  dawn: {
    bgA: "oklch(0.94 0.04 25)",
    bgB: "oklch(0.96 0.03 60)",
    fg: "oklch(0.25 0.02 260)",
    fgSoft: "oklch(0.45 0.02 260)",
    rule: "oklch(0.22 0.02 260 / 0.10)",
    glass: "oklch(0.99 0.01 60 / 0.32)",
    glassBd: "oklch(0.30 0.02 260 / 0.08)",
    glassHl: "oklch(1 0 0 / 0.55)",
    glassSh: "oklch(0.20 0.02 260 / 0.14)",
    orb1: "oklch(0.85 0.10 25 / 0.55)",
    orb2: "oklch(0.90 0.08 320 / 0.40)",
  },
  morning: {
    bgA: "oklch(0.97 0.02 220)",
    bgB: "oklch(0.98 0.02 60)",
    fg: "oklch(0.22 0.02 260)",
    fgSoft: "oklch(0.45 0.02 260)",
    rule: "oklch(0.22 0.02 260 / 0.10)",
    glass: "oklch(0.99 0.01 220 / 0.32)",
    glassBd: "oklch(0.30 0.02 260 / 0.08)",
    glassHl: "oklch(1 0 0 / 0.55)",
    glassSh: "oklch(0.20 0.02 260 / 0.14)",
    orb1: "oklch(0.88 0.07 220 / 0.45)",
    orb2: "oklch(0.92 0.05 60 / 0.40)",
  },
  noon: {
    bgA: "oklch(0.97 0.03 230)",
    bgB: "oklch(0.99 0.01 230)",
    fg: "oklch(0.20 0.02 260)",
    fgSoft: "oklch(0.43 0.02 260)",
    rule: "oklch(0.22 0.02 260 / 0.10)",
    glass: "oklch(0.99 0.005 230 / 0.32)",
    glassBd: "oklch(0.30 0.02 260 / 0.08)",
    glassHl: "oklch(1 0 0 / 0.55)",
    glassSh: "oklch(0.20 0.02 260 / 0.14)",
    orb1: "oklch(0.88 0.06 230 / 0.40)",
    orb2: "oklch(0.92 0.04 200 / 0.35)",
  },
  afternoon: {
    bgA: "oklch(0.95 0.04 60)",
    bgB: "oklch(0.97 0.02 230)",
    fg: "oklch(0.22 0.02 260)",
    fgSoft: "oklch(0.45 0.02 260)",
    rule: "oklch(0.22 0.02 260 / 0.10)",
    glass: "oklch(0.99 0.01 60 / 0.32)",
    glassBd: "oklch(0.30 0.02 260 / 0.08)",
    glassHl: "oklch(1 0 0 / 0.55)",
    glassSh: "oklch(0.20 0.02 260 / 0.14)",
    orb1: "oklch(0.87 0.09 60 / 0.45)",
    orb2: "oklch(0.90 0.06 230 / 0.40)",
  },
  dusk: {
    bgA: "oklch(0.82 0.10 30)",
    bgB: "oklch(0.78 0.09 310)",
    fg: "oklch(0.20 0.02 280)",
    fgSoft: "oklch(0.40 0.02 280)",
    rule: "oklch(0.20 0.02 280 / 0.14)",
    glass: "oklch(0.96 0.02 30 / 0.26)",
    glassBd: "oklch(0.20 0.02 280 / 0.10)",
    glassHl: "oklch(1 0 0 / 0.50)",
    glassSh: "oklch(0.15 0.02 280 / 0.22)",
    orb1: "oklch(0.80 0.13 30 / 0.55)",
    orb2: "oklch(0.72 0.11 310 / 0.45)",
  },
  night: {
    bgA: "oklch(0.20 0.04 260)",
    bgB: "oklch(0.15 0.05 280)",
    fg: "oklch(0.94 0.01 260)",
    fgSoft: "oklch(0.70 0.02 260)",
    rule: "oklch(0.94 0.01 260 / 0.10)",
    glass: "oklch(0.30 0.03 260 / 0.26)",
    glassBd: "oklch(0.94 0.01 260 / 0.10)",
    glassHl: "oklch(1 0 0 / 0.10)",
    glassSh: "oklch(0 0 0 / 0.40)",
    orb1: "oklch(0.45 0.15 280 / 0.40)",
    orb2: "oklch(0.40 0.12 220 / 0.35)",
  },
  deep: {
    bgA: "oklch(0.13 0.03 260)",
    bgB: "oklch(0.10 0.02 260)",
    fg: "oklch(0.94 0.01 260)",
    fgSoft: "oklch(0.62 0.02 260)",
    rule: "oklch(0.94 0.01 260 / 0.08)",
    glass: "oklch(0.22 0.03 260 / 0.30)",
    glassBd: "oklch(0.94 0.01 260 / 0.09)",
    glassHl: "oklch(1 0 0 / 0.08)",
    glassSh: "oklch(0 0 0 / 0.45)",
    orb1: "oklch(0.35 0.13 280 / 0.35)",
    orb2: "oklch(0.30 0.10 220 / 0.30)",
  },
};

export const ACCENTS = {
  gmail: "oklch(0.65 0.18 25)",
  github: "oklch(0.55 0.18 295)",
  calendar: "oklch(0.62 0.18 250)",
  tasks: "oklch(0.62 0.15 320)",
  agent: "oklch(0.70 0.13 50)",
  obsidian: "oklch(0.55 0.20 290)",
  error: "oklch(0.62 0.17 25)",
  good: "oklch(0.65 0.13 150)",
} as const;

export const FONT_SANS =
  '"Geist", Inter, system-ui, -apple-system, sans-serif';
export const FONT_MONO = '"Geist Mono", "JetBrains Mono", ui-monospace, monospace';
export const FONT_DISPLAY = '"Unbounded", "Geist", system-ui, sans-serif';
