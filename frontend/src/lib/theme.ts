import type { CSSProperties } from "react";

/** Mirrors backend/src/auth/theme.ts. */
export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** The Ordely blue, used when the user picked nothing. */
export const DEFAULT_ACCENT = "#1e63ff";

export type Locale = "fr" | "en";

export const ACCENT_PRESETS = [
  { hex: "#1e63ff", fr: "Bleu Ordely", en: "Ordely blue" },
  { hex: "#0b1f44", fr: "Marine", en: "Navy" },
  { hex: "#4f46e5", fr: "Indigo", en: "Indigo" },
  { hex: "#7c3aed", fr: "Violet", en: "Violet" },
  { hex: "#db2777", fr: "Framboise", en: "Raspberry" },
  { hex: "#dc2626", fr: "Rouge", en: "Red" },
  { hex: "#ea580c", fr: "Orange", en: "Orange" },
  { hex: "#16a34a", fr: "Vert", en: "Green" },
  { hex: "#0d9488", fr: "Turquoise", en: "Teal" },
] as const;

/** Surfaces the accent sits on in each theme (--surface in globals.css). */
const LIGHT_SURFACE = "#ffffff";
const DARK_SURFACE = "#0f1f3d";
const DARK_TEXT = "#0a1428";
/** WCAG contrast for UI components; enough for buttons, links and focus rings. */
const MIN_CONTRAST = 3;

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: Rgb, b: Rgb, weightOfB: number): Rgb {
  return a.map((c, i) => c + (b[i] - c) * weightOfB) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Moves the colour toward `target` until it stands out from `surface`. */
function readableOn(color: Rgb, surface: Rgb, target: Rgb): Rgb {
  let out = color;
  for (let w = 0.05; contrast(out, surface) < MIN_CONTRAST && w <= 1; w += 0.05) {
    out = mix(color, target, w);
  }
  return out;
}

/** Button text: white while it stays readable (bold text, 3:1), dark ink on pale accents. */
function textOn(color: Rgb): string {
  return contrast(color, [255, 255, 255]) >= MIN_CONTRAST ? "#ffffff" : DARK_TEXT;
}

/**
 * CSS variables that swap the app accent for the user's colour, in both themes: darkened on
 * white if too pale, lightened on the dark surface if too deep. Null keeps the built-in tokens.
 */
export function accentStyle(hex: string | null | undefined): CSSProperties | undefined {
  if (!hex || !HEX_COLOR.test(hex)) return undefined;
  // Explicitly the Ordely blue (e.g. a picker preview inside an app tinted another colour).
  if (hex.toLowerCase() === DEFAULT_ACCENT) {
    return {
      "--accent": "var(--brand-accent)",
      "--accent-text": "var(--brand-accent-text)",
      "--accent-soft": "var(--brand-accent-soft)",
    } as CSSProperties;
  }
  const base = toRgb(hex);
  const light = readableOn(base, toRgb(LIGHT_SURFACE), [0, 0, 0]);
  // On a dark background a straight brand colour looks heavy: always lift it a little.
  const dark = readableOn(mix(base, [255, 255, 255], 0.2), toRgb(DARK_SURFACE), [255, 255, 255]);
  const lightSoft = mix(light, toRgb(LIGHT_SURFACE), 0.9);
  const darkSoft = mix(toRgb(DARK_SURFACE), dark, 0.22);
  return {
    "--accent": `light-dark(${toHex(light)}, ${toHex(dark)})`,
    "--accent-text": `light-dark(${textOn(light)}, ${textOn(dark)})`,
    "--accent-soft": `light-dark(${toHex(lightSoft)}, ${toHex(darkSoft)})`,
  } as CSSProperties;
}

export function themeClass(mode: string | null | undefined): string {
  return mode === "light" ? "theme-light" : mode === "dark" ? "theme-dark" : "";
}
