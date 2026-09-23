import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Connexion — Ordely" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string }>;
}) {
  const { next, expired } = await searchParams;
  return (
    <AuthForm
      mode="login"
      next={next}
      notice={expired ? "Votre session a expiré. Veuillez vous reconnecter." : undefined}
    />
  );
}
