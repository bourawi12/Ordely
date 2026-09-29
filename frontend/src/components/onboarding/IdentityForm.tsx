"use client";

import { useActionState } from "react";
import { saveIdentity, type StepState } from "@/app/onboarding/actions";
import type { Boutique } from "@/lib/api";
import { PLATFORMS } from "@/lib/onboarding";
import { BackLink, ChoiceCards, FormError } from "./fields";
import styles from "./onboarding.module.css";

export default function IdentityForm({ boutique }: { boutique: Boutique }) {
  const [state, action, pending] = useActionState<StepState, FormData>(saveIdentity, {});
  const v = state.values;

  return (
    <form action={action} className={styles.form}>
      <FormError message={state.error} />
      <label className={styles.field}>
        Nom de la boutique
        <input
          id="name"
          name="name"
          required
          maxLength={100}
          placeholder="Ex. Salma Style"
          defaultValue={(v?.name as string) ?? boutique.name ?? ""}
        />
        <small>Le nom que vos clients connaissent, différent de votre nom personnel.</small>
      </label>
      <label className={styles.field}>
        Téléphone professionnel
        <input
          id="businessPhone"
          name="businessPhone"
          type="tel"
          required
          placeholder="+216 22 445 611"
          pattern="\+?[0-9][0-9 ]{6,18}"
          defaultValue={(v?.businessPhone as string) ?? boutique.businessPhone ?? ""}
        />
        <small>Il apparaît côté client lors des appels.</small>
      </label>
      <fieldset className={styles.fieldset}>
        <legend>Plateforme utilisée</legend>
        <ChoiceCards
          name="platform"
          options={PLATFORMS}
          required
          defaultValue={(v?.platform as string) ?? boutique.platform}
        />
        <small className={styles.help}>
          Pour savoir si vos commandes peuvent arriver automatiquement ou s&apos;il faudra les importer.
        </small>
      </fieldset>
      <div className={styles.actions}>
        <BackLink />
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Enregistrement…" : "Continuer"}
        </button>
      </div>
    </form>
  );
}
