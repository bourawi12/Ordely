"use client";

import Link from "next/link";
import type { Option } from "@/lib/onboarding";
import styles from "./onboarding.module.css";

/** One choice among cards (native radios, so keyboard and plain forms work). */
export function ChoiceCards({
  name,
  options,
  defaultValue,
  required,
  columns = 3,
}: {
  name: string;
  options: Option[];
  defaultValue?: string | null;
  required?: boolean;
  columns?: number;
}) {
  return (
    <div className={styles.choices} style={{ ["--cols" as string]: columns }}>
      {options.map((o) => (
        <label key={o.value} className={styles.choice}>
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={defaultValue === o.value}
            required={required}
          />
          <span>
            {o.label}
            {o.hint && <small>{o.hint}</small>}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Several choices as toggle chips (native checkboxes). */
export function ChoiceChips({
  name,
  options,
  defaultValues = [],
}: {
  name: string;
  options: Option[];
  defaultValues?: string[];
}) {
  return (
    <div className={styles.chips}>
      {options.map((o) => (
        <label key={o.value} className={styles.chip}>
          <input
            type="checkbox"
            name={name}
            value={o.value}
            defaultChecked={defaultValues.includes(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function SelectField({
  id,
  label,
  options,
  defaultValue,
  hint,
}: {
  id: string;
  label: React.ReactNode;
  options: Option[];
  defaultValue?: string | null;
  hint?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select id={id} name={id} defaultValue={defaultValue ?? ""}>
        <option value="">Choisir…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Optional() {
  return <span className={styles.optional}>facultatif</span>;
}

export function BackLink({ href }: { href?: string }) {
  return href ? (
    <Link href={href} className={styles.back}>
      ← Retour
    </Link>
  ) : (
    <span />
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className={styles.error} role="alert">
      {message}
    </p>
  );
}
