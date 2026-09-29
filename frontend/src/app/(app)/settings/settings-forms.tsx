"use client";

import { useActionState, useState } from "react";
import Icon from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import { changePassword, updateProfile, type SettingsActionState } from "./actions";
import { CardFooter, CardHead, useSaveStatus } from "./settings-ui";
import styles from "./settings.module.css";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(
    updateProfile,
    {},
  );
  const [status, dismiss] = useSaveStatus(state);
  const [value, setValue] = useState(name);
  const changed = value.trim() !== "" && value.trim() !== name;

  return (
    <form action={action} onChange={dismiss} className={`${ui.card} ${styles.card}`}>
      <div className={styles.cardBody}>
        <CardHead title="Personal information">
          Your name is shown in the header. Your e-mail address is how you sign in.
        </CardHead>
        <div className={styles.fields}>
          <label className={ui.field}>
            Full name
            <input
              name="name"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              maxLength={100}
              autoComplete="name"
              className={ui.input}
            />
          </label>
          <label className={ui.field}>
            E-mail address
            <span className={styles.readonly}>
              <input type="email" value={email} readOnly className={ui.input} />
              <Icon name="lock" size={16} />
            </span>
          </label>
        </div>
      </div>
      <CardFooter status={status} hint="Your e-mail address can't be changed.">
        <button type="submit" className={ui.btn} disabled={!changed || pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </CardFooter>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(
    changePassword,
    {},
  );
  const [status, dismiss] = useSaveStatus(state);

  return (
    <form action={action} onChange={dismiss} className={`${ui.card} ${styles.card}`}>
      <div className={styles.cardBody}>
        <CardHead title="Password">
          Use a password you don&apos;t use anywhere else. You stay signed in after changing it.
        </CardHead>
        <div className={styles.fields}>
          <label className={ui.field}>
            Current password
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className={ui.input}
            />
          </label>
          <label className={`${ui.field} ${styles.newRow}`}>
            New password
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              className={ui.input}
            />
          </label>
          <label className={ui.field}>
            Confirm new password
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              className={ui.input}
            />
          </label>
        </div>
      </div>
      <CardFooter status={status} hint="At least 8 characters.">
        <button type="submit" className={ui.btn} disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </button>
      </CardFooter>
    </form>
  );
}
