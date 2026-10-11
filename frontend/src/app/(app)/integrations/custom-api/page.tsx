import Link from "next/link";
import ui from "@/components/app/ui.module.css";
import { api } from "@/lib/api";
import { customApiOrdersEndpoint } from "@/lib/integration-endpoints";
import CustomApiDetails from "../custom-api-details";
import styles from "../integrations.module.css";

export const dynamic = "force-dynamic";

export default async function CustomApiPage() {
  const integrations = await api.listIntegrations();
  const apiBase =
    process.env.ORDELY_PUBLIC_API_URL ??
    process.env.BACKEND_URL ??
    "http://localhost:3001/api";
  const endpoint = customApiOrdersEndpoint(apiBase);

  return (
    <div className={styles.detailPage}>
      <Link href="/integrations" className={styles.backLink}>← Integrations</Link>
      <section className={`${ui.card} ${styles.page}`}>
        <p className={styles.eyebrow}>Website connection</p>
        <h1>Custom website API</h1>
        <p className={ui.muted}>
          Send orders from your website to Ordely. Use the API from your website server and keep the key private.
        </p>
        <CustomApiDetails endpoint={endpoint} integration={integrations[0] ?? null} />
      </section>
    </div>
  );
}
