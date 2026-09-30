"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AuthForm from "@/components/AuthForm";
import Icon from "@/components/Icon";
import AccentPicker from "@/components/appearance/AccentPicker";
import ThemePicker from "@/components/appearance/ThemePicker";
import { DEFAULT_ACCENT, accentStyle, type ThemeMode } from "@/lib/theme";
import styles from "@/app/(auth)/register/register.module.css";

const MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Sign-up in two screens: the look of the account (accent colour, picture, theme), then the
 * usual name / e-mail / password form. Everything is sent together when the account is created.
 */
export default function RegisterFlow({ next }: { next?: string }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [picture, setPicture] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);

  useEffect(() => {
    if (!picture) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(picture);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [picture]);

  const choosePicture = (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setPictureError("Format non pris en charge. Utilisez une image JPEG, PNG ou WebP.");
    } else if (file.size > MAX_BYTES) {
      setPictureError("L'image dépasse 2 Mo.");
    } else {
      setPictureError(null);
      setPicture(file);
    }
  };

  // The page previews the chosen colour live (buttons, rings, theme thumbnails).
  const look = accentStyle(accent);
  const loginHref = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div data-wide={step === 1 || undefined} className={styles.flow} style={look}>
      <div hidden={step !== 1}>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            setStep(2);
          }}
        >
          <header>
            <p className={styles.kicker}>Étape 1 sur 2</p>
            <h1>Créer votre compte</h1>
            <p className={styles.subtitle}>
              Donnez à Ordely vos couleurs. Tout est facultatif : vous pouvez passer directement.
            </p>
          </header>

          <fieldset className={styles.section}>
            <legend>Couleur principale</legend>
            <AccentPicker value={accent} onChange={setAccent} locale="fr" />
          </fieldset>

          <fieldset className={styles.section}>
            <legend>Photo de profil</legend>
            <div className={styles.picture}>
              <span className={styles.avatar} aria-hidden="true">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                  <img src={preview} alt="" />
                ) : (
                  <Icon name="user" size={30} />
                )}
              </span>
              <div className={styles.pictureBody}>
                <div className={styles.pictureActions}>
                  <label className={styles.upload}>
                    <input
                      type="file"
                      accept={IMAGE_TYPES.join(",")}
                      className="sr-only"
                      onChange={(e) => {
                        choosePicture(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <Icon name="upload" size={18} />
                    {picture ? "Changer de photo" : "Choisir une photo"}
                  </label>
                  {picture && (
                    <button type="button" className={styles.linkButton} onClick={() => setPicture(null)}>
                      Retirer
                    </button>
                  )}
                </div>
                <small className={pictureError ? styles.pictureError : undefined} role={pictureError ? "alert" : undefined}>
                  {pictureError ?? "JPEG, PNG ou WebP · 2 Mo maximum."}
                </small>
              </div>
            </div>
          </fieldset>

          <fieldset className={styles.section}>
            <legend>Thème</legend>
            <ThemePicker value={theme} onChange={setTheme} locale="fr" />
          </fieldset>

          <button type="submit" className={styles.next}>
            Suivant
          </button>
          <p className={styles.switch}>
            Déjà inscrit ? <Link href={loginHref}>Se connecter</Link>
          </p>
        </form>
      </div>

      <div hidden={step !== 2}>
        <AuthForm
          mode="register"
          next={next}
          header={
            <div className={styles.stepBar}>
              <button type="button" className={styles.back} onClick={() => setStep(1)}>
                <Icon name="chevronLeft" size={18} />
                Personnalisation
              </button>
              <span className={styles.kicker}>Étape 2 sur 2</span>
            </div>
          }
          prepare={(form) => {
            if (accent !== DEFAULT_ACCENT) form.set("accentColor", accent);
            form.set("themeMode", theme);
            if (picture) form.set("avatar", picture);
          }}
        />
      </div>
    </div>
  );
}
