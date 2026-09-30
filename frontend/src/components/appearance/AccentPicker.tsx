"use client";

import { useId, useState, type CSSProperties } from "react";
import { ACCENT_PRESETS, HEX_COLOR, type Locale } from "@/lib/theme";
import styles from "./appearance.module.css";

const COPY = {
  fr: { custom: "Autre couleur", hex: "Code couleur hexadécimal" },
  en: { custom: "Custom colour", hex: "Hex colour code" },
};

/** Preset swatches, a free colour picker and the hex code, all bound to one "#rrggbb" value. */
export default function AccentPicker({
  value,
  onChange,
  locale = "en",
}: {
  value: string;
  onChange: (hex: string) => void;
  locale?: Locale;
}) {
  const group = useId();
  // What is being typed in the hex field; null while it simply shows the value.
  const [draft, setDraft] = useState<string | null>(null);
  const isPreset = ACCENT_PRESETS.some((p) => p.hex === value);
  const copy = COPY[locale];
  const pick = (hex: string) => onChange(hex.toLowerCase());
  // Swatches draw their own colour, not the contrast-adjusted --accent.
  const own = { "--swatch": value } as CSSProperties;

  return (
    <div className={styles.swatches}>
      {ACCENT_PRESETS.map((p) => (
        <label
          key={p.hex}
          className={styles.swatch}
          style={{ "--swatch": p.hex } as CSSProperties}
          title={p[locale]}
        >
          <input
            type="radio"
            name={group}
            checked={value === p.hex}
            onChange={() => pick(p.hex)}
          />
          <span className="sr-only">{p[locale]}</span>
        </label>
      ))}
      <label
        className={`${styles.swatch} ${styles.customSwatch}`}
        style={own}
        data-selected={!isPreset}
        title={copy.custom}
      >
        <input type="color" value={value} onChange={(e) => pick(e.target.value)} />
        <span className="sr-only">{copy.custom}</span>
      </label>
      <label className={styles.hex}>
        <span className="sr-only">{copy.hex}</span>
        <span className={styles.hexDot} style={own} aria-hidden="true" />
        <input
          value={draft ?? value}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value.trim();
            setDraft(v);
            if (HEX_COLOR.test(v)) pick(v);
          }}
          onBlur={() => setDraft(null)}
        />
      </label>
    </div>
  );
}
