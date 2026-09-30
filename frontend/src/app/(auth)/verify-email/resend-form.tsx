"use client";

import { useActionState } from "react";
import styles from "../auth.module.css";
import { resendVerification, type ResendState } from "./actions";
import verify from "./verify-email.module.css";

export function ResendForm() {
  const [state, action, pending] = useActionState<ResendState, FormData>(resendVerification, {});

  return (
    <form action={action} className={verify.resend}>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className={styles.notice} role="status">
          {state.success}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.submit}>
        {pending ? "Envoi…" : "Renvoyer l'e-mail"}
      </button>
      <p className={verify.hint}>Rien reçu ? Pensez à regarder dans vos spams.</p>
    </form>
  );
}
