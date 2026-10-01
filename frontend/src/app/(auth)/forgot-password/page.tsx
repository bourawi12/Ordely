import type { Metadata } from "next";
import ForgotForm from "./forgot-form";

export const metadata: Metadata = { title: "Mot de passe oublié — Ordely" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <ForgotForm email={email} />;
}
