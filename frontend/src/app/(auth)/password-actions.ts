"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { isStrongPassword } from "@/lib/password";
import { setSession } from "@/lib/session";

export interface ForgotState {
  error?: string;
  /** The address the link went to (if it has an account). */
  sentTo?: string;
}

/** Same answer whether the address has an account or not: the API never tells. */
export async function requestReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Indiquez votre adresse e-mail." };
  try {
    await api.forgotPassword(email);
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ApiError && err.status === 429) {
      return {
        error: "Trop de demandes. Patientez une minute avant de réessayer.",
      };
    }
    if (err instanceof ApiError && err.status === 400) {
      return { error: "Cette adresse e-mail n'est pas valide." };
    }
    return {
      error:
        "L'e-mail n'a pas pu être envoyé. Réessayez dans quelques minutes.",
    };
  }
  return { sentTo: email };
}

export interface ResetState {
  error?: string;
  /** The link no longer works: show the way to ask for a new one. */
  expired?: boolean;
}

/** Sets the new password, opens a session with it and goes to the app. */
export async function resetPassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!isStrongPassword(password)) {
    return {
      error:
        "Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial.",
    };
  }
  if (password !== String(formData.get("confirm") ?? "")) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }
  try {
    const result = await api.resetPassword({ token, password });
    await setSession(result.accessToken, result.expiresIn);
  } catch (err) {
    unstable_rethrow(err);
    if (
      err instanceof ApiError &&
      err.message === "This link is invalid or has expired"
    ) {
      return { expired: true };
    }
    if (err instanceof ApiError && err.status === 429) {
      return {
        error: "Trop de tentatives. Patientez une minute avant de réessayer.",
      };
    }
    return { error: "Impossible de joindre le serveur. Réessayez." };
  }
  redirect("/dashboard");
}
