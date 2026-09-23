"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register, type AuthFormState } from "@/app/(auth)/actions";
import styles from "@/app/(auth)/auth.module.css";

interface AuthFormProps {
  mode: "login" | "register";
  next?: string;
  notice?: string;
}

export default function AuthForm({ mode, next, notice }: AuthFormProps) {
  const isLogin = mode === "login";
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    isLogin ? login : register,
    {},
  );
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <form action={action} className={styles.form}>
      <h1>{isLogin ? "Connexion" : "Créer un compte"}</h1>
      <p className={styles.subtitle}>
        {isLogin
          ? "Accédez à votre tableau de bord Ordely."
          : "Commencez à confirmer vos commandes en quelques minutes."}
      </p>

      {notice && !state.error && <p className={styles.notice}>{notice}</p>}
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      {next && <input type="hidden" name="next" value={next} />}

      {!isLogin && (
        <label>
          Nom complet
          <input name="name" autoComplete="name" required maxLength={100} defaultValue={state.name} />
        </label>
      )}
      <label>
        Adresse e-mail
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
        />
      </label>
      <label>
        Mot de passe
        <input
          name="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          required
          minLength={isLogin ? undefined : 8}
          maxLength={72}
        />
      </label>
      {!isLogin && (
        <label>
          Confirmer le mot de passe
          <input name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
        </label>
      )}

      <button type="submit" disabled={pending} className={styles.submit}>
        {pending ? "Veuillez patienter…" : isLogin ? "Se connecter" : "Créer mon compte"}
      </button>

      <p className={styles.switch}>
        {isLogin ? (
          <>
            Pas encore de compte ? <Link href={`/register${suffix}`}>Créer un compte</Link>
          </>
        ) : (
          <>
            Déjà inscrit ? <Link href={`/login${suffix}`}>Se connecter</Link>
          </>
        )}
      </p>
    </form>
  );
}
