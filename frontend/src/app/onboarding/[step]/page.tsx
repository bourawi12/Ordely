import { notFound, redirect } from "next/navigation";
import AgentForm from "@/components/onboarding/AgentForm";
import DetailsForm from "@/components/onboarding/DetailsForm";
import IdentityForm from "@/components/onboarding/IdentityForm";
import PlanForm from "@/components/onboarding/PlanForm";
import Stepper from "@/components/onboarding/Stepper";
import styles from "@/components/onboarding/onboarding.module.css";
import { api } from "@/lib/api";
import { PLAN_STEP, STEPS, stepFromSlug, stepHref } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

const INTROS = [
  "Votre compte est créé. Deux écrans rapides pour que l'agent puisse appeler vos clients au nom de votre boutique.",
  "Réglez comment et quand l'agent appelle vos clients. Vous pourrez tout modifier plus tard.",
  "Facultatif : ces réponses nous aident à adapter l'agent et à vous recommander le bon plan.",
  "Choisissez le forfait qui correspond à votre volume. Vous pourrez en changer plus tard.",
];

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const step = stepFromSlug((await params).step);
  if (!step) notFound();

  const boutique = await api.boutique();
  if (boutique.onboarding.completed) redirect("/dashboard");
  // No skipping past a required screen that is still empty. Once both are filled, the
  // optional details (3) and the plan (4) are both open.
  const { nextStep } = boutique.onboarding;
  if (step > (nextStep === 3 ? PLAN_STEP : nextStep)) redirect(stepHref(nextStep));
  const billing = step === PLAN_STEP ? await api.billingPlans() : null;

  const current = STEPS[step - 1];

  return (
    <div className={styles.card}>
      <Stepper current={step} />
      <header className={styles.head}>
        <p className={styles.kicker}>
          Étape {step} sur {STEPS.length}
          {!current.required && " · facultative"}
        </p>
        <h1>{current.title}</h1>
        <p className={styles.intro}>{INTROS[step - 1]}</p>
      </header>

      {step === 1 && <IdentityForm boutique={boutique} />}
      {step === 2 && <AgentForm boutique={boutique} back={stepHref(1)} />}
      {step === 3 && <DetailsForm boutique={boutique} back={stepHref(2)} />}
      {billing && (
        <PlanForm billing={billing} volume={boutique.dailyOrderVolume} back={stepHref(3)} />
      )}
    </div>
  );
}
