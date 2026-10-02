"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import ui from "@/components/app/ui.module.css";
import type { Order } from "@/lib/api";
import { editOrder, type FormState } from "../actions";
import styles from "../orders.module.css";

/** The order's facts (rendered by the page), swapped for an edit form on demand. */
export default function EditableOrder({ order, children }: { order: Order; children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    editOrder.bind(null, order.id),
    {},
  );

  // A successful save shows the updated facts again.
  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <>
        {children}
        {state.success && <p className={styles.saved}>{state.success}</p>}
        <button type="button" className={`${ui.btnGhost} ${styles.editBtn}`} onClick={() => setEditing(true)}>
          Edit details
        </button>
      </>
    );
  }

  return (
    <form action={action} className={`${styles.form} ${styles.editForm}`}>
      <label className={ui.field}>
        Customer
        <input className={ui.input} name="customer" defaultValue={order.customer} required maxLength={100} />
      </label>
      <label className={ui.field}>
        Phone
        <input
          className={ui.input}
          name="phone"
          type="tel"
          defaultValue={order.phone}
          required
          pattern="\+?[0-9][0-9 ]{6,18}"
        />
      </label>
      <label className={ui.field}>
        Item
        <input className={ui.input} name="item" defaultValue={order.item} required maxLength={200} />
      </label>
      <div className={styles.twoCol}>
        <label className={ui.field}>
          Quantity
          <input
            className={ui.input}
            name="quantity"
            type="number"
            min={1}
            max={1000}
            defaultValue={order.quantity}
            required
          />
        </label>
        <label className={ui.field}>
          Total (TND)
          <input
            className={ui.input}
            name="total"
            type="number"
            min={0}
            step="0.001"
            defaultValue={Number(order.total)}
            required
          />
        </label>
      </div>
      {state.error && <p className={ui.error}>{state.error}</p>}
      <div className={styles.actions}>
        <button type="submit" className={ui.btn} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className={ui.btnGhost} onClick={() => setEditing(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
