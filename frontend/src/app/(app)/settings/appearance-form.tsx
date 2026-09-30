"use client";

import { startTransition, useActionState, useState } from "react";
import AccentPicker from "@/components/appearance/AccentPicker";
import ThemePicker from "@/components/appearance/ThemePicker";
import ui from "@/components/app/ui.module.css";
import { DEFAULT_ACCENT, accentStyle, type ThemeMode } from "@/lib/theme";
import { updateAppearance, type SettingsActionState } from "./actions";
import { CardFooter, useSaveStatus } from "./settings-ui";
import styles from "./settings.module.css";

export function AppearanceForm({
  accentColor,
  themeMode,
}: {
  accentColor: string | null;
  themeMode: ThemeMode;
}) {
  const savedAccent = accentColor ?? DEFAULT_ACCENT;
  const [accent, setAccent] = useState(savedAccent);
  const [theme, setTheme] = useState<ThemeMode>(themeMode);
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(
    updateAppearance,
    {},
  );
  const [status, dismiss] = useSaveStatus(state);
  const changed = accent !== savedAccent || theme !== themeMode;
  const isDefault = accent === DEFAULT_ACCENT && theme === "system";

  return (
    <form
      // Not `action=`: React resets such a form after saving, which would put the theme and
      // colour radios back to the choice they had when the page loaded.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      onChange={dismiss}
      className={`${ui.card} ${styles.card}`}
      // Everything in the card (swatch rings, thumbnails, buttons) shows the colour being picked.
      style={accentStyle(accent)}
    >
      <input type="hidden" name="accentColor" value={accent === DEFAULT_ACCENT ? "" : accent} />
      <input type="hidden" name="themeMode" value={theme} />

      <div className={styles.cardBody}>
        <fieldset className={styles.group}>
          <legend>
            Theme
            <small>Light, dark, or the same as your device.</small>
          </legend>
          <ThemePicker value={theme} onChange={setTheme} />
        </fieldset>

        <hr className={styles.divider} />

        <fieldset className={styles.group}>
          <legend>
            Accent colour
            <small>Used for buttons, links and highlights. Adjusted if needed so text stays readable.</small>
          </legend>
          <AccentPicker value={accent} onChange={setAccent} />
          <div className={styles.preview} aria-hidden="true">
            <span className={styles.previewLabel}>Preview</span>
            <span className={ui.btn}>Call all pending</span>
            <span className={ui.pill}>Last 7 days</span>
            <span className={styles.previewLink}>View all call logs</span>
          </div>
        </fieldset>
      </div>

      <CardFooter status={status} hint="Saved to your account, so it follows you on every device.">
        {!isDefault && (
          <button
            type="button"
            className={ui.btnGhost}
            onClick={() => {
              setAccent(DEFAULT_ACCENT);
              setTheme("system");
              dismiss();
            }}
          >
            Reset to default
          </button>
        )}
        <button type="submit" className={ui.btn} disabled={!changed || pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </CardFooter>
    </form>
  );
}
