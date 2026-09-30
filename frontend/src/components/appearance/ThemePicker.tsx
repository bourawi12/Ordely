"use client";

import { useId } from "react";
import { THEME_MODES, type Locale, type ThemeMode } from "@/lib/theme";
import styles from "./appearance.module.css";

const LABELS: Record<Locale, Record<ThemeMode, string>> = {
  fr: { system: "Système", light: "Clair", dark: "Sombre" },
  en: { system: "System", light: "Light", dark: "Dark" },
};

/** One card per theme, each with a tiny drawing of the app in the colour being picked. */
export default function ThemePicker({
  value,
  onChange,
  locale = "en",
}: {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  locale?: Locale;
}) {
  const group = useId();

  return (
    <div className={styles.themes}>
      {THEME_MODES.map((mode) => (
        <label key={mode} className={styles.themeCard}>
          <input
            type="radio"
            name={group}
            value={mode}
            className="sr-only"
            checked={value === mode}
            onChange={() => onChange(mode)}
          />
          <span className={styles.thumb} aria-hidden="true">
            <Mock scheme={mode === "dark" ? "dark" : "light"} />
            {mode === "system" && (
              <span className={styles.thumbHalf}>
                <Mock scheme="dark" />
              </span>
            )}
          </span>
          <span className={styles.themeLabel}>
            <span className={styles.radioDot} aria-hidden="true" />
            {LABELS[locale][mode]}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Sidebar, title, two cards and a button, drawn with the app tokens in the given scheme. */
function Mock({ scheme }: { scheme: "light" | "dark" }) {
  return (
    <span className={`${styles.mock} ${scheme === "dark" ? styles.mockDark : styles.mockLight}`}>
      <span className={styles.mockSide}>
        <i className={styles.mockActive} />
        <i />
        <i />
      </span>
      <span className={styles.mockMain}>
        <i className={styles.mockTitle} />
        <span className={styles.mockCards}>
          <i />
          <i />
        </span>
        <i className={styles.mockButton} />
      </span>
    </span>
  );
}
