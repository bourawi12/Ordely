"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import PasswordRules from "@/components/PasswordRules";
import styles from "../auth.module.css";
import { resetPassword, type ResetState } from "../password-actions";
import verify from "../verify-email/verify-email.module.css";

export function InvalidLink() {
  return (
    <div className={`${styles.form} ${verify.status}`}>
      <span className={`${verify.icon} ${verify.bad}`} aria-hidden="true">
        <Icon name="xCircle" size={30} />
      </span>
      <h1>Ce lien n&apos;est plus valide</h1>
      <p className={verify.text}>
        Il a déjà servi ou il a expiré (un lien est valable 1 heure).
        Demandez-en un nouveau.
      </p>
      <Link
        href="/forgot-password"
        className={`${styles.submit} ${verify.cta}`}
      >
        Recevoir un nouveau lien
      </Link>
    </div>
  );
}

export default function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    resetPassword,
    {},
  );
  // Drives the checklist. React empties the fields after each submit.
  const [password, setPassword] = useState("");
  useEffect(() => setPassword(""), [state]);

  if (state.expired) return <InvalidLink />;

  return (
    <form action={action} className={styles.form}>
      <h1>Nouveau mot de passe</h1>
      <p className={styles.subtitle}>
        Choisissez votre nouveau mot de passe. Vous serez connecté juste après,
        et déconnecté de vos autres appareils.
      </p>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <input type="hidden" name="token" value={token} />
      <label>
        Nouveau mot de passe
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="password-rules"
        />
      </label>
      <div className={styles.passwordRules}>
        <PasswordRules id="password-rules" value={password} locale="fr" />
      </div>
      <label>
        Confirmer le mot de passe
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
        />
      </label>
      <button type="submit" disabled={pending} className={styles.submit}>
        {pending ? "Veuillez patienter…" : "Changer mon mot de passe"}
      </button>
    </form>
  );
}
