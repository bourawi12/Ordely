"use client";

import ui from "@/components/app/ui.module.css";
import styles from "@/components/admin/admin.module.css";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.errorBox} role="alert">
      <h2>This report could not be loaded</h2>
      <p>
        {error.message && !error.message.includes("digest")
          ? error.message
          : "The API did not answer as expected. Try again in a moment."}
      </p>
      <button type="button" className={ui.btn} onClick={reset}>
        Try again
      </button>
    </div>
  );
}
