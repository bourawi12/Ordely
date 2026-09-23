"use client";

import { useActionState, useEffect, useRef } from "react";
import { createOrder, type FormState } from "@/app/(app)/orders/actions";
import ui from "@/components/app/ui.module.css";
import styles from "@/app/(app)/orders/orders.module.css";

export default function NewOrderForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createOrder, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [state, pending]);

  return (
    <form ref={formRef} action={action} className={`${ui.card} ${ui.cardPad} ${styles.form}`}>
      <h2 className={ui.cardTitle}>New order</h2>
      <label className={ui.field}>
        Customer
        <input className={ui.input} name="customer" required maxLength={100} />
      </label>
      <label className={ui.field}>
        Phone
        <input
          className={ui.input}
          name="phone"
          type="tel"
          required
          placeholder="+216 22 445 611"
          pattern="\+?[0-9][0-9 ]{6,18}"
        />
      </label>
      <label className={ui.field}>
        Item
        <input className={ui.input} name="item" required maxLength={200} />
      </label>
      <div className={styles.twoCol}>
        <label className={ui.field}>
          Quantity
          <input className={ui.input} name="quantity" type="number" min={1} max={1000} defaultValue={1} required />
        </label>
        <label className={ui.field}>
          Total (TND)
          <input className={ui.input} name="total" type="number" min={0} step="0.001" required />
        </label>
      </div>
      {state.error && <p className={ui.error}>{state.error}</p>}
      <button type="submit" className={ui.btn} disabled={pending}>
        {pending ? "Creating…" : "Create order"}
      </button>
    </form>
  );
}
