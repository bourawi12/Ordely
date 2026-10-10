"use client";

import { useState } from "react";
import { useActionState } from "react";
import Icon from "@/components/Icon";
import type { Integration } from "@/lib/api";
import { createIntegration, testIntegration, updateIntegration, type IntegrationActionState } from "./actions";
import styles from "./integrations.module.css";

function Help({ children }: { children: string }) {
  return <details className={styles.help}><summary aria-label="Show explanation">?</summary><span>{children}</span></details>;
}

function CopyField({ label, value, help }: { label: string; value: string; help: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <div className={styles.secretField}><div className={styles.fieldLabel}><span>{label}</span><Help>{help}</Help></div><div className={styles.copyRow}><code>{value}</code><button type="button" className={styles.copyButton} onClick={copy}>{copied ? "Copied" : "Copy"}</button></div></div>;
}

function ActionMessage({ state }: { state: IntegrationActionState }) {
  if (!state.error && !state.success) return null;
  return <p className={`${styles.message} ${state.error ? styles.error : styles.success}`} role={state.error ? "alert" : "status"}>{state.error ?? state.success}</p>;
}

export default function IntegrationSetup({ initialIntegration }: { initialIntegration: Integration | null }) {
  const [created, createAction, creating] = useActionState(createIntegration, {});
  const [updated, updateAction, updating] = useActionState(updateIntegration, {});
  const [tested, runTest, testing] = useActionState(testIntegration, {});
  const integration = created.integration ?? updated.integration ?? tested.integration ?? initialIntegration;
  const [showGuide, setShowGuide] = useState(false);

  if (!integration && !created.apiKey) {
    return <main className={styles.page}><header className={styles.pageHead}><div><p className={styles.eyebrow}>Connect your store</p><h1>Bring new orders into Ordely.</h1><p className={styles.intro}>Your website sends orders to Ordely. We confirm the customer details, then send the result back to your website.</p></div><span className={styles.heroIcon}><Icon name="plug" size={28} /></span></header><section className={styles.steps}><div className={styles.step}><span>01</span><div><h2>Tell us where to send updates</h2><p>Paste the server address on your website that should receive order confirmations.</p></div><Help>This is usually supplied by the person who manages your website. It is not your normal homepage address.</Help></div><form action={createAction} className={styles.setupForm}><label>Website callback address <Help>Ordely uses this address to tell your website that an order was confirmed, cancelled, or needs attention.</Help><input name="webhookUrl" type="url" placeholder="https://your-store.com/api/ordely/status" /></label><button className={styles.primaryButton} type="submit" disabled={creating}><Icon name="plug" size={17} />{creating ? "Connecting..." : "Create connection"}</button><ActionMessage state={created} /></form></section><section className={styles.guide}><button type="button" onClick={() => setShowGuide((value) => !value)}><Icon name="headset" size={16} />{showGuide ? "Hide setup help" : "I need help finding this address"}</button>{showGuide && <p>Ask your website developer for a server-side URL that can receive a POST request. For the demo store, this will be the website’s order-status endpoint.</p>}</section></main>;
  }

  if (!integration) return null;

  const apiKey = created.apiKey;
  const webhookSecret = created.webhookSecret;
  return <main className={styles.page}><header className={styles.pageHead}><div><p className={styles.eyebrow}>Store connection</p><h1>Your store is connected.</h1><p className={styles.intro}>Use these details in your website’s server settings. Keep the keys private.</p></div><span className={`${styles.heroIcon} ${styles.connected}`}><Icon name="check" size={28} /></span></header>{apiKey && <section className={styles.credentials}><div className={styles.sectionTitle}><div><p className={styles.eyebrow}>Save these now</p><h2>Your private connection details</h2></div><Help>These values are shown once. If you lose them, create a new connection key.</Help></div><div className={styles.warning}><Icon name="shield" size={18} /><span>Never paste these keys into browser code or share them in a public chat.</span></div><CopyField label="Order API key" value={apiKey} help="Your website uses this key when it sends a new order to Ordely." /><CopyField label="Webhook secret" value={webhookSecret ?? ""} help="Your website uses this secret to check that status messages really came from Ordely." /></section>}<section className={styles.settingsCard}><div className={styles.sectionTitle}><div><p className={styles.eyebrow}>Status updates</p><h2>Where should Ordely reply?</h2></div><Help>After a call, Ordely sends the order result to this address.</Help></div><form action={updateAction} className={styles.setupForm}><label>Website callback address <input name="webhookUrl" type="url" defaultValue={integration?.webhookUrl ?? ""} placeholder="https://your-store.com/api/ordely/status" /></label><button className={styles.secondaryButton} type="submit" disabled={updating}>{updating ? "Saving..." : "Save address"}</button><ActionMessage state={updated} /></form></section><section className={styles.testCard}><div><p className={styles.eyebrow}>Ready to check</p><h2>Send a test message</h2><p>Ordely will send a small test event to your callback address. No order will be created.</p></div><form action={runTest}><button className={styles.primaryButton} type="submit" disabled={testing}><Icon name="play" size={16} />{testing ? "Testing..." : "Test connection"}</button><ActionMessage state={tested} /></form></section><section className={styles.guide}><button type="button" onClick={() => setShowGuide((value) => !value)}><Icon name="monitor" size={16} />{showGuide ? "Hide developer instructions" : "Show developer instructions"}</button>{showGuide && <pre>{`POST /api/integrations/orders\nAuthorization: Bearer ${apiKey ?? integration.apiKeyPrefix + "..."}\nIdempotency-Key: your-store-order-id\n\nOrdely sends status updates to your callback address.`}</pre>}</section></main>;
}