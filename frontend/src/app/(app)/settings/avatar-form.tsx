"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import { initials } from "@/lib/format";
import { removeAvatar, uploadAvatar, type SettingsActionState } from "./actions";
import styles from "./settings.module.css";

const MAX_BYTES = 2 * 1024 * 1024;

export function AvatarForm({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [uploadState, upload, uploading] = useActionState<SettingsActionState, FormData>(
    uploadAvatar,
    {},
  );
  const [removeState, remove, removing] = useActionState<SettingsActionState>(removeAvatar, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Drop the local preview once the server has the new picture.
  useEffect(() => {
    if (uploadState.success) {
      setPreview(null);
      formRef.current?.reset();
    }
  }, [uploadState]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const state = removeState.success || removeState.error ? removeState : uploadState;
  const error = localError ?? state.error;
  const shown = preview ?? avatarUrl;
  const busy = uploading || removing;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalError(null);
    const file = e.target.files?.[0];
    if (!file) return setPreview(null);
    if (file.size > MAX_BYTES) {
      e.target.value = "";
      setPreview(null);
      return setLocalError("L'image dépasse 2 Mo.");
    }
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className={styles.avatarBlock}>
      <span className={styles.avatarPreview} aria-hidden="true">
        {shown ? (
          // Signed MinIO URL or local preview blob.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" />
        ) : (
          initials(name)
        )}
      </span>

      <div className={styles.avatarBody}>
        <p className={styles.avatarTitle}>Photo de profil</p>
        <p className={styles.hint}>JPEG, PNG ou WebP, 2 Mo maximum.</p>

        {error && (
          <div className={styles.alertError} role="alert">
            <Icon name="xCircle" size={18} />
            <span>{error}</span>
          </div>
        )}
        {!error && state.success && (
          <div className={styles.alertSuccess} role="status">
            <Icon name="check" size={18} />
            <span>{state.success}</span>
          </div>
        )}

        <div className={styles.avatarActions}>
          <form ref={formRef} action={upload} className={styles.avatarUpload}>
            <label className={ui.btnGhost}>
              <Icon name="download" size={16} />
              {preview ? "Choisir une autre" : "Choisir une image"}
              <input
                id="avatar-file"
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={onPick}
              />
            </label>
            {preview && (
              <button type="submit" className={ui.btn} disabled={busy}>
                {uploading ? "Envoi…" : "Enregistrer la photo"}
              </button>
            )}
          </form>
          {avatarUrl && !preview && (
            <form action={remove}>
              <button type="submit" className={`${ui.btnGhost} ${styles.dangerText}`} disabled={busy}>
                <Icon name="trash" size={16} />
                {removing ? "Suppression…" : "Supprimer"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
