import Link from "next/link";
import ui from "@/components/app/ui.module.css";
import { api } from "@/lib/api";
import OutboundWebhookSettings from "./settings";
import styles from "../integrations.module.css";

export const dynamic = "force-dynamic";

const webhookSchema = `{
  "id": "d9e6061f-2a50-4d9f-8e99-c2c7ef7e4d16",
  "event": "order.confirmed",
  "createdAt": "2026-10-11T12:00:00.000Z",
  "order": {
    "ordelyOrderId": 123,
    "externalOrderId": "shop-order-1001",
    "status": "confirmed"
  }
}`;

const webhookHeaders = `Content-Type: application/json
X-Ordely-Event: order.confirmed
X-Ordely-Signature: t=1760162400,v1=<hmac-sha256-hex>`;

export default async function OutboundWebhooksPage() {
  const integrations = await api.listIntegrations();
  const integration = integrations[0] ?? null;

  return (
    <div className={styles.detailPage}>
      <Link href="/integrations" className={styles.backLink}>← Integrations</Link>
      <section className={`${ui.card} ${styles.page}`}>
        <p className={styles.eyebrow}>Order status updates</p>
        <h1>Outbound order webhooks</h1>
        <p className={ui.muted}>
          Ordely sends a status update to your website when an imported order is confirmed or cancelled.
        </p>
        {integration ? (
          <OutboundWebhookSettings webhookUrl={integration.webhookUrl} />
        ) : (
          <div className={styles.webhookCallout}>
            <strong>Set up Custom Website API first</strong>
            <p>The callback URL is saved with your shop’s website connection.</p>
            <Link href="/integrations/custom-api" className={styles.pageAction}>
              Set up Custom Website API
            </Link>
          </div>
        )}
        <h2 className={styles.sectionTitle}>Events sent</h2>
        <ul className={styles.eventList}>
          <li><code>order.confirmed</code></li>
          <li><code>order.cancelled</code></li>
        </ul>

        <div className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Payload schema</h2>
          <p className={ui.muted}>Each event includes the order IDs and final state so the storefront can update its local record.</p>
          <pre className={styles.example}><code>{webhookSchema}</code></pre>
        </div>

        <div className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Headers</h2>
          <pre className={styles.example}><code>{webhookHeaders}</code></pre>
        </div>
      </section>
    </div>
  );
}
