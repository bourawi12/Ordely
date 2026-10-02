import type { Metadata } from "next";
import ResetForm, { InvalidLink } from "./reset-form";

export const metadata: Metadata = { title: "Nouveau mot de passe — Ordely" };

/** Opened from the emailed link, with or without a session in this browser. */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return token ? <ResetForm token={token} /> : <InvalidLink />;
}
