// Canonical MARTA rail line colors — single source of truth.
// Also used client-side in public/app.js (inlined since app.js cannot import TS).

export const LINE_COLORS = {
  RED: "#E05555",
  GOLD: "#D4A020",
  BLUE: "#4A9FE5",
  GREEN: "#3BAA6E",
} as const;
