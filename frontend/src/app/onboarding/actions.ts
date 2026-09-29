"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { api, ApiError, type BoutiqueSection } from "@/lib/api";
import { stepHref, type StepNumber } from "@/lib/onboarding";

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

/** Screen 3 (optional): save the answers — or nothing on "skip" — then open the app. */
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
    await api.completeOnboarding();
  } catch (err) {
    unstable_rethrow(err);
    return { error: describe(err), values };
  }
  redirect("/dashboard");
}
