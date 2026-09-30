"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export interface ResendState {
  error?: string;
  success?: string;
}

export async function resendVerification(): Promise<ResendState> {
  try {
    await api.resendVerification();
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ApiError) {
      if (err.status === 409) {
        // Confirmed in the meantime (e.g. from another device).
        redirect("/onboarding");
      }
      if (err.status === 429) {
        return {
          error: "Un e-mail vient d'être envoyé. Patientez une minute avant d'en demander un autre.",
        };
      }
      return { error: "L'e-mail n'a pas pu être envoyé. Réessayez dans quelques minutes." };
    }
    return { error: "Impossible de joindre le serveur. Réessayez." };
  }
  return { success: "C'est envoyé ! Un nouveau lien vient de partir, l'ancien ne fonctionne plus." };
}
