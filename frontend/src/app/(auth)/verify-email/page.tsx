import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import Icon from "@/components/Icon";
import { api, ApiError } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import styles from "../auth.module.css";
import { ResendForm } from "./resend-form";
import verify from "./verify-email.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmez votre adresse — Ordely" };

/**
 * Without a token: "check your inbox", right after sign-up (or whenever the API reports an
 * unconfirmed address). With a token: the emailed link, which confirms the address.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return token ? <LinkResult token={token} /> : <CheckInbox />;
}

async function CheckInbox() {
  if (!(await getSessionToken())) {
    redirect("/login?next=/verify-email");
  }
  const user = await api.me();
  if (user.emailVerifiedAt) {
    redirect("/onboarding");
  }

  return (
    <div className={`${styles.form} ${verify.status}`}>
      <span className={verify.icon} aria-hidden="true">
        <Icon name="mail" size={28} />
      </span>
      <h1>Vérifiez votre boîte mail</h1>
      <p className={verify.text}>
        Nous avons envoyé un lien de confirmation à{" "}
        <strong>{user.email}</strong>. Cliquez dessus pour activer votre compte
        : le lien est valable 24 heures.
      </p>
      <ResendForm />
      <form action={logout} className={verify.switch}>
        Mauvaise adresse ?{" "}
        <button type="submit" className={verify.linkButton}>
          Se déconnecter
        </button>
      </form>
    </div>
  );
}

/** Works with or without a session in this browser: the link may be opened on a phone. */
async function LinkResult({ token }: { token: string }) {
  let email: string | null = null;
  try {
    ({ email } = await api.verifyEmail(token));
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
  }
  const signedIn = Boolean(await getSessionToken());

  if (email) {
    return (
      <div className={`${styles.form} ${verify.status}`}>
        <span className={`${verify.icon} ${verify.ok}`} aria-hidden="true">
          <Icon name="check" size={30} />
        </span>
        <h1>Adresse confirmée</h1>
        <p className={verify.text}>
          <strong>{email}</strong> est vérifiée : votre compte est actif. Il ne
          reste qu&apos;à configurer votre boutique.
        </p>
        <Link
          href={signedIn ? "/onboarding" : "/login?next=/onboarding"}
          className={`${styles.submit} ${verify.cta}`}
        >
          {signedIn ? "Continuer" : "Se connecter"}
        </Link>
      </div>
    );
  }

  return (
    <div className={`${styles.form} ${verify.status}`}>
      <span className={`${verify.icon} ${verify.bad}`} aria-hidden="true">
        <Icon name="xCircle" size={30} />
      </span>
      <h1>Ce lien n&apos;est plus valide</h1>
      <p className={verify.text}>
        Il a déjà servi ou il a expiré (un lien est valable 24 heures). Si votre
        adresse est déjà confirmée, connectez-vous simplement ; sinon, demandez
        un nouveau lien.
      </p>
      <Link
        href={signedIn ? "/verify-email" : "/login?next=/verify-email"}
        className={`${styles.submit} ${verify.cta}`}
      >
        {signedIn ? "Recevoir un nouveau lien" : "Se connecter"}
      </Link>
    </div>
  );
}
