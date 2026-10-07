"use client";

import { startTransition, useActionState, useState } from "react";
import { choosePlan, type PlanState } from "@/app/onboarding/actions";
import type { BillingPlans } from "@/lib/api";
import { ORDER_VOLUMES } from "@/lib/onboarding";
import {
  formatCardNumber,
  formatExpiry,
  TEST_CARDS,
  tokenizeTestCard,
  type CardError,
} from "@/lib/payment";
import { BackLink, FormError } from "./fields";
import styles from "./onboarding.module.css";

const CARD_ERRORS: Record<CardError, string> = {
  number: "Le numéro de carte doit compter 16 chiffres.",
  expiry: "Date d'expiration invalide ou dépassée (MM/AA).",
  cvc: "Le code de sécurité compte 3 chiffres.",
  name: "Indiquez le nom du titulaire.",
  test_only:
    "Mode test : utilisez une des cartes de test ci-dessous, pas une vraie carte.",
};

const number = new Intl.NumberFormat("fr-TN");

/**
 * Screen 4: the plan. The one that fits the declared daily volume is preselected; a paid plan
 * is paid here before the app opens. Card details never leave the browser: they become a
 * token (lib/payment.ts), and only the token is sent.
 */
export default function PlanForm({
  billing,
  volume,
  back,
}: {
  billing: BillingPlans;
  volume: string | null;
  back: string;
}) {
  const [state, action, pending] = useActionState<
    PlanState,
    { plan: string; paymentToken?: string }
  >(choosePlan, {});
  const { plans, recommended, payments } = billing;
  const canPay = payments.available;
  // Without online payment, only the free plan can be taken.
  const [selected, setSelected] = useState(canPay ? recommended : "free");
  const [card, setCard] = useState({
    number: "",
    expiry: "",
    cvc: "",
    name: "",
  });
  const [cardError, setCardError] = useState<string | null>(null);

  const plan = plans.find((p) => p.code === selected) ?? plans[0];
  const paid = plan.price > 0;
  const volumeLabel = ORDER_VOLUMES.find(
    (o) => o.value === volume,
  )?.label.toLowerCase();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setCardError(null);
    if (!paid) {
      return startTransition(() => action({ plan: plan.code }));
    }
    const result = tokenizeTestCard(card);
    if ("error" in result) return setCardError(CARD_ERRORS[result.error]);
    startTransition(() =>
      action({ plan: plan.code, paymentToken: result.token }),
    );
  }

  return (
    <form onSubmit={submit} className={styles.form} noValidate>
      <FormError message={cardError ?? state.error} />

      <fieldset className={styles.fieldset}>
        <legend>
          {volumeLabel
            ? `Pour ${volumeLabel}, nous vous recommandons ${plans.find((p) => p.code === recommended)?.label}`
            : "Choisissez votre forfait"}
        </legend>
        <div className={styles.plans}>
          {plans.map((p) => {
            const locked = p.price > 0 && !canPay;
            return (
              <label
                key={p.code}
                className={styles.plan}
                data-locked={locked || undefined}
              >
                <input
                  type="radio"
                  name="plan"
                  value={p.code}
                  checked={selected === p.code}
                  disabled={locked || pending}
                  onChange={() => {
                    setSelected(p.code);
                    setCardError(null);
                  }}
                />
                <span className={styles.planBody}>
                  <span className={styles.planName}>
                    {p.label}
                    {p.code === recommended && (
                      <em className={styles.planBadge}>Recommandé</em>
                    )}
                  </span>
                  <span className={styles.planPrice}>
                    {p.price === 0
                      ? "Gratuit"
                      : `${number.format(p.price)} TND`}
                    {p.price > 0 && <small>par mois</small>}
                  </span>
                  <span className={styles.planQuota}>
                    {number.format(p.quota)} appels par mois
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {!canPay && (
          <small className={styles.help}>
            Le paiement en ligne n&apos;est pas encore disponible : commencez
            avec le forfait gratuit, vous pourrez passer à un forfait payant
            plus tard.
          </small>
        )}
      </fieldset>

      {paid && (
        <fieldset className={`${styles.fieldset} ${styles.payment}`}>
          <legend>Paiement par carte</legend>
          {payments.testMode && (
            <p className={styles.testMode} role="note">
              <span>
                <strong>Mode test.</strong> Aucun montant n&apos;est débité et
                aucune vraie carte n&apos;est acceptée. Cliquez sur une carte de
                test pour remplir le formulaire :
              </span>
              {TEST_CARDS.map((c) => (
                <button
                  key={c.token}
                  type="button"
                  className={styles.testCard}
                  onClick={() =>
                    setCard({
                      number: formatCardNumber(c.number),
                      expiry: "12/30",
                      cvc: "123",
                      name: "Test Ordely",
                    })
                  }
                >
                  <code>{formatCardNumber(c.number)}</code> {c.label}
                </button>
              ))}
            </p>
          )}
          <label className={styles.field}>
            Numéro de carte
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              value={card.number}
              onChange={(e) =>
                setCard({ ...card, number: formatCardNumber(e.target.value) })
              }
            />
          </label>
          <div className={styles.twoCols}>
            <label className={styles.field}>
              Expiration
              <input
                inputMode="numeric"
                autoComplete="off"
                placeholder="MM/AA"
                value={card.expiry}
                onChange={(e) =>
                  setCard({ ...card, expiry: formatExpiry(e.target.value) })
                }
              />
            </label>
            <label className={styles.field}>
              Code de sécurité
              <input
                inputMode="numeric"
                autoComplete="off"
                placeholder="123"
                maxLength={3}
                value={card.cvc}
                onChange={(e) =>
                  setCard({ ...card, cvc: e.target.value.replace(/\D/g, "") })
                }
              />
            </label>
          </div>
          <label className={styles.field}>
            Nom du titulaire
            <input
              autoComplete="off"
              value={card.name}
              maxLength={100}
              onChange={(e) => setCard({ ...card, name: e.target.value })}
            />
          </label>
          <small className={styles.help}>
            Vous payez {number.format(plan.price)} TND pour le premier mois du
            forfait {plan.label}.
          </small>
        </fieldset>
      )}

      <div className={styles.actions}>
        <BackLink href={back} />
        <div className={styles.actionGroup}>
          <button type="submit" className={styles.primary} disabled={pending}>
            {pending
              ? "Veuillez patienter…"
              : paid
                ? `Payer ${number.format(plan.price)} TND et terminer`
                : "Commencer gratuitement"}
          </button>
        </div>
      </div>
    </form>
  );
}
