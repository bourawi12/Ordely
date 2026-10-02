"use client";

import { useActionState, useRef, useState } from "react";
import { importOrders, type ImportState } from "@/app/(app)/orders/actions";
import Icon from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import styles from "@/app/(app)/orders/orders.module.css";

export default function CsvImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importOrders, {});
  const [fileName, setFileName] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const hasResult = state.imported !== undefined;
  const hasErrors = state.errors && state.errors.length > 0;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileName(file?.name ?? null);
  }

  function openModal() {
    setShowModal(true);
    setFileName(null);
    // Reset the form + input so a previous selection doesn't stick
    formRef.current?.reset();
  }

  function closeModal() {
    setShowModal(false);
    setFileName(null);
    formRef.current?.reset();
  }

  return (
    <>
      <button type="button" className={ui.btnGhost} onClick={openModal} id="csv-import-btn">
        <Icon name="upload" size={16} />
        Import CSV
      </button>

      {showModal && (
        <div className={styles.overlay} onClick={closeModal}>
          <div
            className={`${ui.card} ${ui.cardPad} ${styles.importModal}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <h2 className={ui.cardTitle}>Import orders from CSV</h2>
              <button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="Close">
                <Icon name="x" size={18} />
              </button>
            </div>

            <p className={styles.importHint}>
              Your CSV file must include these column headers:{" "}
              <strong>customer</strong>, <strong>phone</strong>, <strong>item</strong>,{" "}
              <strong>quantity</strong>, <strong>total</strong>.
              <br />
              <span className={styles.importAliases}>
                Aliases like <em>client</em>, <em>product</em>, <em>qty</em>, <em>price</em>, or{" "}
                <em>montant</em> are also accepted.
              </span>
            </p>

            <form ref={formRef} action={action}>
              <div
                className={styles.dropZone}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add(styles.dragOver); }}
                onDragLeave={(e) => e.currentTarget.classList.remove(styles.dragOver)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove(styles.dragOver);
                  const dt = e.dataTransfer;
                  if (dt.files.length > 0 && inputRef.current) {
                    inputRef.current.files = dt.files;
                    setFileName(dt.files[0].name);
                  }
                }}
              >
                <Icon name="upload" size={32} className={styles.dropIcon} />
                {fileName ? (
                  <span className={styles.fileName}>{fileName}</span>
                ) : (
                  <span className={styles.dropText}>
                    Drag & drop your CSV file here, or <strong>browse</strong>
                  </span>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  name="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className={styles.hiddenInput}
                />
              </div>

              <button
                type="submit"
                className={ui.btn}
                disabled={pending || !fileName}
                style={{ width: "100%", marginTop: "1rem" }}
              >
                {pending ? "Importing…" : "Import orders"}
              </button>
            </form>

            {/* Error from the action */}
            {state.error && (
              <div className={styles.importAlert} data-type="error">
                <Icon name="xCircle" size={18} />
                {state.error}
              </div>
            )}

            {/* Success result */}
            {hasResult && !state.error && (
              <div className={styles.importResult}>
                <div className={styles.importAlert} data-type="success">
                  <Icon name="check" size={18} />
                  <strong>{state.imported}</strong> order{state.imported !== 1 ? "s" : ""} imported
                  successfully.
                  {state.failed! > 0 && (
                    <span>
                      {" "}
                      <strong>{state.failed}</strong> row{state.failed !== 1 ? "s" : ""} skipped.
                    </span>
                  )}
                </div>

                {hasErrors && (
                  <details className={styles.errorDetails}>
                    <summary>
                      Show {state.errors!.length} error{state.errors!.length !== 1 ? "s" : ""}
                    </summary>
                    <ul className={styles.errorList}>
                      {state.errors!.map((e) => (
                        <li key={e.row}>
                          <strong>Row {e.row}:</strong> {e.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
