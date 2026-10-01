"use client";

import { useActionState, useState, type ReactNode } from "react";
import ui from "@/components/app/ui.module.css";
import type { Boutique } from "@/lib/api";
import {
  ACQUISITION_SOURCES,
  ALL_ZONES,
  CALL_LANGUAGES,
  CARRIERS,
  CONFIRMATION_PROCESSES,
  GOUVERNORATS,
  ORDER_VOLUMES,
  PLATFORMS,
  SECTORS,
  type Option,
} from "@/lib/onboarding";
import {
  updateShopAgent,
  updateShopDetails,
  updateShopIdentity,
  type ShopActionState,
} from "./actions";
import { CardFooter, CardHead, useSaveStatus } from "./settings-ui";
import styles from "./settings.module.css";

/** One shop card: the form, its save status and its Save button. */
function ShopCard({
  title,
  description,
  action,
  pending,
  state,
  children,
}: {
  title: string;
  description: ReactNode;
  action: (formData: FormData) => void;
  pending: boolean;
  state: ShopActionState;
  children: ReactNode;
}) {
  const [status, dismiss] = useSaveStatus(state);
  return (
    <form action={action} onChange={dismiss} className={`${ui.card} ${styles.card}`}>
      <div className={styles.cardBody}>
        <CardHead title={title}>{description}</CardHead>
        <div className={styles.fields}>{children}</div>
      </div>
      <CardFooter status={status}>
        <button type="submit" className={ui.btn} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </CardFooter>
    </form>
  );
}

function Select({
  name,
  label,
  options,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <label className={ui.field}>
      {label}
      <select name={name} defaultValue={defaultValue ?? ""} required={required} className={ui.input}>
        <option value="">{required ? "Choose…" : "Not set"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.en ?? o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function pick<T>(values: ShopActionState["values"], key: string, fallback: T): T {
  return (values?.[key] as T | undefined) ?? fallback;
}

export function ShopIdentityForm({ boutique }: { boutique: Boutique }) {
  const [state, action, pending] = useActionState<ShopActionState, FormData>(
    updateShopIdentity,
    {},
  );
  const v = state.values;

  return (
    <ShopCard
      title="Shop"
      description="The name and number the agent calls your customers on behalf of."
      action={action}
      pending={pending}
      state={state}
    >
      <label className={ui.field}>
        Shop name
        <input
          name="name"
          defaultValue={pick(v, "name", boutique.name ?? "")}
          required
          maxLength={100}
          className={ui.input}
        />
      </label>
      <label className={ui.field}>
        Business phone
        <input
          name="businessPhone"
          type="tel"
          defaultValue={pick(v, "businessPhone", boutique.businessPhone ?? "")}
          required
          pattern="\+?[0-9][0-9 ]{6,18}"
          autoComplete="tel"
          className={ui.input}
        />
      </label>
      <Select
        name="platform"
        label="Sales platform"
        options={PLATFORMS}
        defaultValue={pick(v, "platform", boutique.platform)}
        required
      />
    </ShopCard>
  );
}

export function ShopAgentForm({ boutique }: { boutique: Boutique }) {
  const [state, action, pending] = useActionState<ShopActionState, FormData>(
    updateShopAgent,
    {},
  );
  const v = state.values;
  const languages = pick(v, "callLanguages", boutique.callLanguages);

  return (
    <ShopCard
      title="Call agent"
      description="When and in which languages the agent calls. Tunis time, at least one hour."
      action={action}
      pending={pending}
      state={state}
    >
      <fieldset className={`${styles.checks} ${styles.fullRow}`}>
        <legend>Call languages</legend>
        {CALL_LANGUAGES.map((o) => (
          <label key={o.value} className={styles.checkLine}>
            <input
              type="checkbox"
              name="callLanguages"
              value={o.value}
              defaultChecked={languages.includes(o.value)}
            />
            {o.en ?? o.label}
          </label>
        ))}
      </fieldset>
      <label className={ui.field}>
        Calls from
        <input
          name="callStartTime"
          type="time"
          defaultValue={pick(v, "callStartTime", boutique.callStartTime ?? "09:00")}
          required
          className={ui.input}
        />
      </label>
      <label className={ui.field}>
        Calls until
        <input
          name="callEndTime"
          type="time"
          defaultValue={pick(v, "callEndTime", boutique.callEndTime ?? "20:00")}
          required
          className={ui.input}
        />
      </label>
      <Select
        name="confirmationProcess"
        label="Current confirmation process"
        options={CONFIRMATION_PROCESSES}
        defaultValue={pick(v, "confirmationProcess", boutique.confirmationProcess)}
      />
    </ShopCard>
  );
}

export function ShopDetailsForm({ boutique }: { boutique: Boutique }) {
  const [state, action, pending] = useActionState<ShopActionState, FormData>(
    updateShopDetails,
    {},
  );
  const v = state.values;
  const zones = pick(v, "deliveryZones", boutique.deliveryZones);
  const [wholeCountry, setWholeCountry] = useState(zones.includes(ALL_ZONES));

  return (
    <ShopCard
      title="Business details"
      description="Optional. Helps the agent adapt its tone and check delivery addresses."
      action={action}
      pending={pending}
      state={state}
    >
      <Select
        name="sector"
        label="Sector"
        options={SECTORS}
        defaultValue={pick(v, "sector", boutique.sector)}
      />
      <Select
        name="dailyOrderVolume"
        label="Daily orders"
        options={ORDER_VOLUMES}
        defaultValue={pick(v, "dailyOrderVolume", boutique.dailyOrderVolume)}
      />
      <Select
        name="carrier"
        label="Carrier"
        options={CARRIERS}
        defaultValue={pick(v, "carrier", boutique.carrier)}
      />
      <Select
        name="acquisitionSource"
        label="How you heard of Ordely"
        options={ACQUISITION_SOURCES}
        defaultValue={pick(v, "acquisitionSource", boutique.acquisitionSource)}
      />
      <fieldset className={`${styles.checks} ${styles.fullRow}`}>
        <legend>Delivery zones</legend>
        <label className={styles.checkLine}>
          <input
            type="checkbox"
            name="deliveryZones"
            value={ALL_ZONES}
            checked={wholeCountry}
            onChange={(e) => setWholeCountry(e.target.checked)}
          />
          All of Tunisia
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
              {g.en ?? g.label}
            </label>
          ))}
        </div>
      </fieldset>
    </ShopCard>
  );
}
