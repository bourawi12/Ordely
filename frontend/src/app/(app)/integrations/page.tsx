import ui from "@/components/app/ui.module.css";
import { api } from "@/lib/api";
import Link from "next/link";
import styles from "./integrations.module.css";

export const dynamic = "force-dynamic";

const PLACEHOLDERS = [
  ["Shopify", "Native store orders, status sync, and webhook registration."],
  ["WooCommerce", "WordPress store order intake and status synchronization."],
  ["PrestaShop / Magento", "Connect larger or regional ecommerce platforms."],
  ["JavaScript checkout widget", "Add Ordely order confirmation to any custom checkout."],
  ["Hosted confirmation page", "Redirect customers to an Ordely-managed confirmation flow."],
  ["Embedded iframe", "Place an Ordely confirmation surface inside an existing website."],
  ["CSV import / export", "Move orders in batches from legacy tools or spreadsheets."],
  ["Zapier / Make / n8n", "Connect Ordely to no-code automation workflows."],
  ["Email order parser", "Turn structured store notification emails into orders."],
  ["CRM / ERP", "Synchronize customers, order outcomes, inventory, and invoices."],
  ["Carriers and delivery", "Send confirmed orders to delivery and logistics providers."],

] as const;

export default async function IntegrationsPage() {
  const integrations = await api.listIntegrations();

  return (
    <section className={`${ui.card} ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Connections</p>
          <h1>Website integrations</h1>
        </div>
        <span className={ui.pill}>{integrations.length} active</span>
      </div>
      <p className={ui.muted}>
        Connect store orders, confirmation workflows, and downstream operations from one place.
      </p>
      <div className={styles.grid}>
        <Link href="/integrations/custom-api" className={`${styles.integration} ${styles.active} ${styles.integrationLink}`}>
          <span className={styles.cardTop}>
            <strong>Custom website API</strong>
            <span className={integrations[0] ? styles.statusActive : styles.statusAvailable}>
              {integrations[0] ? integrations[0].status : "Set up"}
            </span>
          </span>
          <span className={styles.cardDescription}>
            Send website orders to Ordely with a private, shop-specific API key.
          </span>
          <span className={styles.cardAction}>
            {integrations[0] ? `Key ${integrations[0].apiKeyPrefix}... · View details` : "Open setup"}
          </span>
        </Link>
        <Link href="/integrations/outbound-webhooks" className={`${styles.integration} ${styles.integrationLink}`}>
          <span className={styles.cardTop}>
            <strong>Outbound order webhooks</strong>
            <span className={styles.statusAvailable}>Available</span>
          </span>
          <span className={styles.cardDescription}>
            Send confirmed or cancelled order status to your ecommerce website.
          </span>
          <span className={styles.cardAction}>Configure website callback</span>
        </Link>
        {PLACEHOLDERS.map(([name, description]) => (
          <article className={styles.integration} key={name}>
            <div className={styles.cardTop}>
              <h2>{name}</h2>
              <span className={styles.statusPlanned}>Planned</span>
            </div>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
