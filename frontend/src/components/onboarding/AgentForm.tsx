"use client";

import { useActionState } from "react";
import { saveAgent, type StepState } from "@/app/onboarding/actions";
import type { Boutique } from "@/lib/api";
import { CALL_LANGUAGES, CONFIRMATION_PROCESSES } from "@/lib/onboarding";
import { BackLink, ChoiceCards, ChoiceChips, FormError, Optional } from "./fields";
import styles from "./onboarding.module.css";

export default function AgentForm({ boutique, back }: { boutique: Boutique; back: string }) {
  const [state, action, pending] = useActionState<StepState, FormData>(saveAgent, {});
  const v = state.values;
  const languages = (v?.callLanguages as string[]) ?? boutique.callLanguages;

  return (
    <form action={action} className={styles.form}>
      <FormError message={state.error} />
      <fieldset className={styles.fieldset}>
        <legend>Langues des appels</legend>
        <ChoiceChips
          name="callLanguages"
          options={CALL_LANGUAGES}
          defaultValues={languages.length ? languages : ["darija", "french"]}
        />
        <small className={styles.help}>
          Cochez-en plusieurs : l&apos;agent suit la langue du client, mélange darija/français compris.
        </small>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Heures d&apos;appel autorisées</legend>
        <div className={styles.hours}>
          <label className={styles.field}>
            De
            <input
              id="callStartTime"
              name="callStartTime"
              type="time"
              required
              defaultValue={(v?.callStartTime as string) ?? boutique.callStartTime ?? "09:00"}
            />
          </label>
          <label className={styles.field}>
            À
            <input
              id="callEndTime"
              name="callEndTime"
              type="time"
              required
              defaultValue={(v?.callEndTime as string) ?? boutique.callEndTime ?? "20:00"}
            />
          </label>
        </div>
        <small className={styles.help}>
          Heure de Tunis, au moins une heure. L&apos;agent n&apos;appelle jamais en dehors.
        </small>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>
          Aujourd&apos;hui, qui confirme vos commandes ? <Optional />
        </legend>
        <ChoiceCards
          name="confirmationProcess"
          options={CONFIRMATION_PROCESSES}
          columns={2}
          defaultValue={(v?.confirmationProcess as string) ?? boutique.confirmationProcess}
        />
      </fieldset>

      <div className={styles.actions}>
        <BackLink href={back} />
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Enregistrement…" : "Continuer"}
        </button>
      </div>
    </form>
  );
}
