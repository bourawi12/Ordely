"use client";

import { useActionState, useState } from "react";
import { finishOnboarding, type StepState } from "@/app/onboarding/actions";
import type { Boutique } from "@/lib/api";
import {
  ACQUISITION_SOURCES,
  ALL_ZONES,
  CARRIERS,
  GOUVERNORATS,
  ORDER_VOLUMES,
  SECTORS,
} from "@/lib/onboarding";
import { BackLink, ChoiceCards, FormError, SelectField } from "./fields";
import styles from "./onboarding.module.css";

export default function DetailsForm({ boutique, back }: { boutique: Boutique; back: string }) {
  const [state, action, pending] = useActionState<StepState, FormData>(finishOnboarding, {});
  const v = state.values;
  const zones = (v?.deliveryZones as string[]) ?? boutique.deliveryZones;
  const [wholeCountry, setWholeCountry] = useState(zones.includes(ALL_ZONES));

  return (
    <form action={action} className={styles.form}>
      <FormError message={state.error} />

      <fieldset className={styles.fieldset}>
        <legend>Secteur d&apos;activité</legend>
        <ChoiceCards name="sector" options={SECTORS} defaultValue={(v?.sector as string) ?? boutique.sector} />
        <small className={styles.help}>Pour adapter le ton et le vocabulaire de l&apos;agent.</small>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Zones de livraison</legend>
        <label className={styles.checkLine}>
          <input
            type="checkbox"
            name="deliveryZones"
            value={ALL_ZONES}
            checked={wholeCountry}
            onChange={(e) => setWholeCountry(e.target.checked)}
          />
          Toute la Tunisie
        </label>
        <div className={styles.zones} aria-disabled={wholeCountry}>
          {GOUVERNORATS.map((g) => (
            <label key={g.value} className={styles.checkLine}>
              <input
                type="checkbox"
                name="deliveryZones"
                value={g.value}
                disabled={wholeCountry}
                defaultChecked={zones.includes(g.value)}
              />
              {g.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.twoCols}>
        <SelectField
          id="dailyOrderVolume"
          label="Volume moyen de commandes"
          options={ORDER_VOLUMES}
          defaultValue={(v?.dailyOrderVolume as string) ?? boutique.dailyOrderVolume}
          hint="Pour vous recommander le bon plan."
        />
        <SelectField
          id="acquisitionSource"
          label="Comment avez-vous connu Ordely ?"
          options={ACQUISITION_SOURCES}
          defaultValue={(v?.acquisitionSource as string) ?? boutique.acquisitionSource}
        />
      </div>

      <fieldset className={styles.fieldset}>
        <legend>Transporteur habituel</legend>
        <ChoiceCards
          name="carrier"
          options={CARRIERS}
          columns={4}
          defaultValue={(v?.carrier as string) ?? boutique.carrier}
        />
      </fieldset>

      <div className={styles.actions}>
        <BackLink href={back} />
        <div className={styles.actionGroup}>
          <button type="submit" name="intent" value="skip" className={styles.secondary} disabled={pending}>
            Passer
          </button>
          <button type="submit" name="intent" value="finish" className={styles.primary} disabled={pending}>
            {pending ? "Enregistrement…" : "Terminer"}
          </button>
        </div>
      </div>
    </form>
  );
}
