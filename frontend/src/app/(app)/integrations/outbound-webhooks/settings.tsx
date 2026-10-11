"use client";

import { useState, useTransition } from "react";
import ui from "@/components/app/ui.module.css";
import { generateCustomApiWebhookSecret, saveCustomApiWebhookUrl } from "../actions";
import styles from "../integrations.module.css";

export default function OutboundWebhookSettings({
  webhookUrl: initialUrl,
}: {
  webhookUrl: string | null;
}) {
  const [webhookUrl, setWebhookUrl] = useState(initialUrl ?? "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    startTransition(async () => {
      try {
        await saveCustomApiWebhookUrl(webhookUrl);
        setSaved(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save callback URL.");
      }
    });
  }

  function generateSecret() {
    setError("");
    setWebhookSecret("");
    startTransition(async () => {
      try {
        const result = await generateCustomApiWebhookSecret();
        setWebhookSecret(result.webhookSecret ?? "");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not generate signing secret.");
      }
    });
  }

  async function copySecret() {
    await navigator.clipboard.writeText(webhookSecret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <form className={styles.webhookSettings} onSubmit={save}>
      <label className={styles.detailLabel} htmlFor="outbound-webhook-url">
        Ecommerce website callback URL
      </label>
      <p className={ui.muted}>
        Enter the server endpoint that should receive Ordely order status updates.
      </p>
      <input
        id="outbound-webhook-url"
        className={ui.input}
        type="url"
        value={webhookUrl}
        onChange={(event) => setWebhookUrl(event.target.value)}
        placeholder="https://your-store.com/api/ordely/status"
        maxLength={500}
        required
      />
      <button className={styles.pageAction} type="submit" disabled={pending || !webhookUrl.trim()}>
        {pending ? "Saving…" : "Save callback URL"}
      </button>
      {saved && <p className={styles.success} role="status">Callback URL saved</p>}
      <div className={styles.signingSecret}>
        <strong>Webhook signing secret</strong>
        <p className={ui.muted}>Generate this secret, then set it as <code>ORDELY_WEBHOOK_SECRET</code> on your ecommerce server. Generating a new one invalidates the old secret.</p>
        {webhookSecret ? (
          <div className={styles.copyRow}>
            <code>{webhookSecret}</code>
            <button type="button" onClick={copySecret}>Copy secret</button>
          </div>
        ) : (
          <button className={styles.pageAction} type="button" onClick={generateSecret} disabled={pending}>
            {pending ? "Generating…" : "Generate signing secret"}
          </button>
        )}
        {copied && <p className={styles.success} role="status">Secret copied</p>}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  );
}
