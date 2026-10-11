"use client";

import { useState, useTransition } from "react";
import ui from "@/components/app/ui.module.css";
import { createCustomApiKey } from "./actions";
import styles from "./integrations.module.css";

const example = `{
  "externalOrderId": "shop-order-1001",
  "customer": {
    "name": "Ahmed",
    "phone": "+216 22 000 000",
    "address": "10 Example Street, Tunis"
  },
  "items": [
    { "productName": "Black shoes", "quantity": 1, "unitPrice": 120 }
  ],
  "total": 120,
  "currency": "TND"
}`;

type Integration = {
  apiKeyPrefix: string;
};

export default function CustomApiDetails({
  integration,
  endpoint: configuredEndpoint,
}: {
  integration: Integration | null;
  endpoint: string;
}) {
  const [generated, setGenerated] = useState<{ apiKey: string; endpoint: string; warning: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [pending, startTransition] = useTransition();

  function generateKey() {
    setError("");
    startTransition(async () => {
      try {
        setGenerated(await createCustomApiKey());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not create API key.");
      }
    });
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1500);
  }

  const endpoint = generated?.endpoint ?? configuredEndpoint;

  return (
    <div className={styles.detailsContent}>
      <div className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Order endpoint</h2>
        <div className={styles.copyRow}>
          <code>{endpoint}</code>
          <button type="button" onClick={() => copy("URL", endpoint)}>Copy URL</button>
        </div>
      </div>

      {generated ? (
        <div className={styles.keyNotice}>
          <strong>New API key</strong>
          <p>{generated.warning}</p>
          <div className={styles.copyRow}>
            <code>{generated.apiKey}</code>
            <button type="button" onClick={() => copy("API key", generated.apiKey)}>Copy key</button>
          </div>
        </div>
      ) : integration ? (
        <div className={styles.keyNotice}>
          <strong>API key configured</strong>
          <p>The full key is only shown once when created. Your saved key starts with {integration.apiKeyPrefix}.</p>
        </div>
      ) : (
        <div className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>API key</h2>
          <p className={ui.muted}>Generate a private key for this Ordely shop. It identifies which client owns incoming orders.</p>
          <button type="button" className={styles.pageAction} onClick={generateKey} disabled={pending}>
            {pending ? "Generating…" : "Generate API key"}
          </button>
        </div>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
      {copied && <p className={styles.success} role="status">{copied} copied</p>}

      <div className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Order request</h2>
        <pre className={styles.example}><code>{example}</code></pre>
        <p className={ui.muted}>Send JSON with the <code>x-ordely-api-key</code> header. Keep the key on your website server, never in browser code.</p>
      </div>
    </div>
  );
}
