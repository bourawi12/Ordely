"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { api, ApiError, type BoutiqueSection } from "@/lib/api";
import { PLAN_STEP, stepHref, type StepNumber } from "@/lib/onboarding";

export interface StepState {
  error?: string;
  /** What the merchant typed, sent back so a refused screen loses nothing. */
  values?: Record<string, string | string[] | undefined>;
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optional(formData: FormData, key: string): string | undefined {
  return text(formData, key) || undefined;
}

function list(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String);
}

function describe(err: unknown): string {
  return err instanceof ApiError
    ? err.message
    : "Impossible de joindre le serveur. Réessayez dans un instant.";
}

async function save(
  section: BoutiqueSection,
  values: NonNullable<StepState["values"]>,
  next: StepNumber,
): Promise<StepState> {
  try {
    await api.updateBoutique(section, values);
  } catch (err) {
    unstable_rethrow(err);
    return { error: describe(err), values };
  }
  redirect(stepHref(next));
}

/** Screen 1 (required). */
export async function saveIdentity(_prev: StepState, formData: FormData) {
  return save(
    "identity",
    {
      name: text(formData, "name"),
      businessPhone: text(formData, "businessPhone"),
      platform: text(formData, "platform"),
    },
    2,
  );
}

/** Screen 2 (required). */
export async function saveAgent(_prev: StepState, formData: FormData) {
  return save(
    "agent",
    {
      callLanguages: list(formData, "callLanguages"),
      callStartTime: text(formData, "callStartTime"),
      callEndTime: text(formData, "callEndTime"),
      confirmationProcess: optional(formData, "confirmationProcess"),
    },
    3,
  );
}

/** Screen 3 (optional): save the answers — or nothing on "skip" — then go choose a plan. */
export async function finishOnboarding(_prev: StepState, formData: FormData): Promise<StepState> {
  const values = {
    sector: optional(formData, "sector"),
    deliveryZones: list(formData, "deliveryZones"),
    dailyOrderVolume: optional(formData, "dailyOrderVolume"),
    acquisitionSource: optional(formData, "acquisitionSource"),
    carrier: optional(formData, "carrier"),
  };
  try {
    if (formData.get("intent") !== "skip") {
      await api.updateBoutique("details", values);
    }
  } catch (err) {
    unstable_rethrow(err);
    return { error: describe(err), values };
  }
  redirect(stepHref(PLAN_STEP));
}

export interface PlanState {
  error?: string;
}

/** What the API says in English, said in French on this screen. */
const PAYMENT_ERRORS: Record<string, string> = {
  "Your card was declined.": "Votre carte a été refusée. Essayez une autre carte.",
  "Your card has insufficient funds.": "Solde insuffisant sur cette carte.",
  "Unknown test card": "Mode test : utilisez une des cartes de test proposées.",
};

/**
 * Screen 4: take the chosen plan — paying first if it is a paid one — then open the app.
 * `paymentToken` is the card token made in the browser; no card number reaches this server.
 */
export async function choosePlan(
  _prev: PlanState,
  choice: { plan: string; paymentToken?: string },
): Promise<PlanState> {
  try {
    await api.subscribe(choice);
    await api.completeOnboarding();
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ApiError) {
      if (err.status === 503) {
        return { error: "Le paiement en ligne n'est pas encore disponible. Choisissez le forfait gratuit pour l'instant." };
      }
      if (err.status === 429) {
        return { error: "Trop de tentatives. Patientez une minute avant de réessayer." };
      }
      return { error: PAYMENT_ERRORS[err.message] ?? "Le paiement n'a pas abouti. Réessayez." };
    }
    return { error: describe(err) };
  }
  redirect("/dashboard");
}
