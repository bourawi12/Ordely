"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import Icon from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import { initials } from "@/lib/format";
import { saveAvatar, type SettingsActionState } from "./actions";
import { CardFooter, CardHead, useSaveStatus } from "./settings-ui";
import styles from "./settings.module.css";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Picking a file uploads it right away; the picture itself is also a way to pick one. */
export function AvatarForm({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [state, action, pending] = useActionState<
    SettingsActionState,
    FormData
  >(saveAvatar, {});
  const [status, dismiss] = useSaveStatus(state);
  const [intent, setIntent] = useState<"upload" | "remove">("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileId = useId();

  // Each answer from the server replaces the local preview with the stored picture.
  useEffect(() => setPreview(null), [state]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setLocalError(null);
    if (!file) return;
    const problem = !TYPES.includes(file.type)
      ? "Unsupported format. Use a JPEG, PNG or WebP image."
      : file.size > MAX_BYTES
        ? "The image is larger than 2 MB."
        : null;
    if (problem) {
      e.target.value = "";
      setLocalError(problem);
      return;
    }
    setIntent("upload");
    setPreview(URL.createObjectURL(file));
    formRef.current?.requestSubmit();
  }

  const shown = preview ?? avatarUrl;
  const busyText = intent === "remove" ? "Removing…" : "Uploading…";

  return (
    <form
      ref={formRef}
      action={action}
      onChange={dismiss}
      className={`${ui.card} ${styles.card}`}
    >
      <div className={`${styles.cardBody} ${styles.avatarCard}`}>
        <div className={styles.avatarInfo}>
          <CardHead title="Profile picture">
            Shown next to your name in the header. Click the picture to change
            it.
          </CardHead>
          <div className={styles.avatarActions}>
            <label
              className={`${ui.btnGhost} ${styles.fileBtn}`}
              data-disabled={pending || undefined}
            >
              <Icon name="upload" size={17} />
              {avatarUrl ? "Change picture" : "Upload picture"}
              <input
                id={fileId}
                type="file"
                name="file"
                accept={TYPES.join(",")}
                className="sr-only"
                onChange={onPick}
                disabled={pending}
              />
            </label>
            {avatarUrl && (
              <button
                type="submit"
                name="intent"
                value="remove"
                className={`${ui.btnGhost} ${styles.danger}`}
                disabled={pending}
                onClick={() => {
                  setIntent("remove");
                  setLocalError(null);
                }}
              >
                <Icon name="trash" size={17} />
                Remove
              </button>
            )}
          </div>
        </div>

        <label
          htmlFor={fileId}
          className={styles.avatarBig}
          data-busy={pending || undefined}
        >
          {shown ? (
            // Signed MinIO URL or local preview blob.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" />
          ) : (
            <span aria-hidden="true">{initials(name)}</span>
          )}
          <span className={styles.avatarOverlay} aria-hidden="true">
            {pending ? (
              <span className={styles.spinner} />
            ) : (
              <Icon name="upload" size={22} />
            )}
          </span>
          <span className="sr-only">Change picture</span>
        </label>
      </div>
      <CardFooter
        status={pending ? null : localError ? { error: localError } : status}
        hint={pending ? busyText : "JPEG, PNG or WebP, up to 2 MB."}
      />
    </form>
  );
}
