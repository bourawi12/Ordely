"use client";

import Link from "next/link";
import { useActionState } from "react";
import Icon from "@/components/Icon";
import styles from "../auth.module.css";
import { requestReset, type ForgotState } from "../password-actions";
import verify from "../verify-email/verify-email.module.css";

export default function ForgotForm({ email }: { email?: string }) {
  const [state, action, pending] = useActionState<ForgotState, FormData>(
    requestReset,
    {},
  );

  if (state.sentTo) {
    return (
      <div className={`${styles.form} ${verify.status}`}>
        <span className={verify.icon} aria-hidden="true">
          <Icon name="mail" size={28} />
        </span>
        <h1>Vérifiez votre boîte mail</h1>
        <p className={verify.text}>
          Si un compte existe pour <strong>{state.sentTo}</strong>, un lien pour
          choisir un nouveau mot de passe vient de lui être envoyé. Il est
          valable 1 heure.
        </p>
        <p className={verify.hint}>
          Rien reçu ? Pensez à regarder dans vos spams.
        </p>
        <p className={styles.switch}>
          <Link href="/login">Retour à la connexion</Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className={styles.form}>
      <h1>Mot de passe oublié</h1>
      <p className={styles.subtitle}>
        Indiquez l&apos;adresse de votre compte : nous vous enverrons un lien
        pour en choisir un nouveau.
      </p>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <label>
        Adresse e-mail
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={email}
        />
      </label>
      <button type="submit" disabled={pending} className={styles.submit}>
        {pending ? "Envoi…" : "Envoyer le lien"}
      </button>
      <p className={styles.switch}>
        Vous vous en souvenez ? <Link href="/login">Se connecter</Link>
      </p>
    </form>
  );
}
