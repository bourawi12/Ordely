"use client";

import { useActionState } from "react";
import Icon from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import {
  changePassword,
  updateProfile,
  type SettingsActionState,
} from "./actions";
import styles from "./settings.module.css";

interface ProfileFormProps {
  initialName: string;
  email: string;
}

export function ProfileForm({ initialName, email }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState<
    SettingsActionState,
    FormData
  >(updateProfile, {});

  return (
    <form action={formAction} className={styles.form}>
      {state.success && (
        <div className={styles.alertSuccess} role="status">
          <Icon name="check" size={18} />
          <span>{state.success}</span>
        </div>
      )}
      {state.error && (
        <div className={styles.alertError} role="alert">
          <Icon name="xCircle" size={18} />
          <span>{state.error}</span>
        </div>
      )}

      <div className={styles.row}>
        <label htmlFor="settings-name" className={styles.label}>
          Nom complet doniaaaaaaaa
        </label>
        <input
          id="settings-name"
          name="name"
          type="text"
          defaultValue={initialName}
          required
          maxLength={100}
          className={styles.input}
          placeholder="Ex : Ahmed Ben Salem"
        />
      </div>

      <div className={styles.row}>
        <label htmlFor="settings-email" className={styles.label}>
          Adresse e-mail
          <span className={styles.hint}>Identifiant unique</span>
        </label>
        <input
          id="settings-email"
          type="email"
          value={email}
          disabled
          className={`${styles.input} ${styles.inputDisabled}`}
          style={{ color: "#e91a2bff" }}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          disabled={isPending}
          className={ui.btn}
        >
          {isPending ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState<
    SettingsActionState,
    FormData
  >(changePassword, {});

  return (
    <form action={formAction} className={styles.form}>
      {state.success && (
        <div className={styles.alertSuccess} role="status">
          <Icon name="check" size={18} />
          <span>{state.success}</span>
        </div>
      )}
      {state.error && (
        <div className={styles.alertError} role="alert">
          <Icon name="xCircle" size={18} />
          <span>{state.error}</span>
        </div>
      )}

      <div className={styles.row}>
        <label htmlFor="currentPassword" className={styles.label}>
          Mot de passe actuel
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={styles.input}
          placeholder="••••••••"
        />
      </div>

      <div className={styles.row}>
        <label htmlFor="newPassword" className={styles.label}>
          Nouveau mot de passe
          <span className={styles.hint}>Minimum 8 caractères</span>
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          className={styles.input}
          placeholder="••••••••"
        />
      </div>

      <div className={styles.row}>
        <label htmlFor="confirmPassword" className={styles.label}>
          Confirmer le nouveau mot de passe
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          className={styles.input}
          placeholder="••••••••"
        />
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          disabled={isPending}
          className={ui.btn}
        >
          {isPending ? "Mise à jour…" : "Mettre à jour le mot de passe"}
        </button>
      </div>
    </form>
  );
}
