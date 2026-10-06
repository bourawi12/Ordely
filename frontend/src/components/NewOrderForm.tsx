"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createOrder, type FormState } from "@/app/(app)/orders/actions";
import Icon from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import styles from "@/app/(app)/orders/orders.module.css";

interface ItemRow {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export default function NewOrderForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createOrder, {});
  const [showModal, setShowModal] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<ItemRow[]>([
    { productName: "", quantity: 1, unitPrice: 0 },
  ]);

  useEffect(() => {
    if (!pending && !state.error && state.success !== undefined) {
      formRef.current?.reset();
      setItems([{ productName: "", quantity: 1, unitPrice: 0 }]);
      setShowModal(false);
    }
  }, [state, pending]);

  const openModal = () => {
    setShowModal(true);
    setItems([{ productName: "", quantity: 1, unitPrice: 0 }]);
    formRef.current?.reset();
  };

  const closeModal = () => {
    setShowModal(false);
    setItems([{ productName: "", quantity: 1, unitPrice: 0 }]);
    formRef.current?.reset();
  };

  const addItem = () => {
    setItems((prev) => [...prev, { productName: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ItemRow, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const computedTotal = items.reduce(
    (sum, item) => sum + item.quantity * (item.unitPrice || 0),
    0,
  );

  return (
    <>
      <button type="button" className={ui.btn} onClick={openModal} id="new-order-btn">
        <Icon name="plus" size={16} />
        New Order
      </button>

      {showModal && (
        <div className={styles.overlay} onClick={closeModal}>
          <div
            className={`${ui.card} ${ui.cardPad} ${styles.importModal}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <h2 className={ui.cardTitle}>Create new order</h2>
              <button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="Close">
                <Icon name="x" size={18} />
              </button>
            </div>

            <form ref={formRef} action={action} className={styles.form}>
              <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />
              <label className={ui.field}>
                Customer
                <input className={ui.input} name="customer" required maxLength={100} placeholder="e.g. Sonia Ben Ali" />
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

              <div style={{ marginTop: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg-muted)" }}>Order Items</span>
                  <button type="button" onClick={addItem} className={ui.btnSec} style={{ padding: "0.2rem 0.5rem", fontSize: "0.78rem" }}>
                    + Add item
                  </button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className={styles.itemRow}>
                    <input
                      className={ui.input}
                      placeholder="Product name"
                      value={item.productName}
                      required
                      onChange={(e) => updateItem(idx, "productName", e.target.value)}
                    />
                    <input
                      className={ui.input2}
                      type="number"
                      min={1}
                      max={1000}
                      placeholder="Qty"
                      value={item.quantity}
                      required
                      onChange={(e) => updateItem(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <input
                      className={ui.input2}
                      type="number"
                      min={0}
                      step="0.001"
                      placeholder="Price TND"
                      value={item.unitPrice || ""}
                      onChange={(e) => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger, #ef4444)", padding: "0.3rem" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <label className={ui.field} style={{ marginTop: "0.5rem" }}>
                Total (TND)
                <input
                  className={ui.input}
                  name="total"
                  type="number"
                  min={0}
                  step="0.001"
                  value={computedTotal > 0 ? computedTotal : ""}
                  placeholder="Calculated automatically"
                  onChange={() => {}}
                />
              </label>

              {state.error && <p className={ui.error}>{state.error}</p>}
              <button type="submit" className={ui.btn} disabled={pending} style={{ width: "100%", marginTop: "0.5rem" }}>
                {pending ? "Creating…" : "Create order"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
