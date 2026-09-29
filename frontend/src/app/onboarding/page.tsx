import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { stepHref } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

/** /onboarding → the first screen still to fill, or the app once everything is done. */
export default async function OnboardingIndex() {
  const { onboarding } = await api.boutique();
  redirect(onboarding.completed ? "/dashboard" : stepHref(onboarding.nextStep));
}
