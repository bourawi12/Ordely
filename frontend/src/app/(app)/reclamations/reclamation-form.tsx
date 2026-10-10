"use client";

import { useActionState } from "react";
import ui from "@/components/app/ui.module.css";
import { createReclamation, type ReclamationFormState } from "./actions";
import styles from "./reclamations.module.css";

const initialState: ReclamationFormState = {};

export default function ReclamationForm() {
  const [state, action, pending] = useActionState(createReclamation, initialState);

  return (
    <form action={action} className={`${ui.card} ${styles.formCard}`}>
      <div className={styles.formHead}>
        <div>
          <p className={styles.eyebrow}>Contact support</p>
          <h2 className={styles.cardTitle}>Tell us what went wrong</h2>
        </div>
        <span className={styles.formHint}>Ordely team</span>
      </div>
      <label className={ui.field}>
        Subject
        <input name="subject" className={ui.input} maxLength={150} required placeholder="Short summary of the issue" />
      </label>
      <label className={ui.field}>
        Description
        <textarea
          name="description"
          className={`${ui.input} ${styles.textarea}`}
          maxLength={5000}
          required
          rows={7}
          placeholder="Give us the details we need to investigate."
        />
      </label>
      <label className={ui.field}>
        Order reference <span className={styles.optional}>optional</span>
        <input name="orderId" className={ui.input} inputMode="numeric" placeholder="For example, 1042" />
      </label>
      {state.error && <p className={ui.error} role="alert">{state.error}</p>}
      <div className={styles.formActions}>
        <button type="submit" className={ui.btn} disabled={pending}>
          {pending ? "Sending..." : "Send reclamation"}
        </button>
      </div>
    </form>
  );
}