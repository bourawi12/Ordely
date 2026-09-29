export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** "#RRGGBB" — what an <input type="color"> produces. */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
