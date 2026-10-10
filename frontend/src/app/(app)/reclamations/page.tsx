import Link from "next/link";
import ui from "@/components/app/ui.module.css";
import { api, type ReclamationStatus } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import ReclamationForm from "./reclamation-form";
import styles from "./reclamations.module.css";

export const dynamic = "force-dynamic";

const FILTERS: { value?: ReclamationStatus; label: string }[] = [
  { label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

function statusLabel(status: ReclamationStatus) {
  return status === "in_progress" ? "In progress" : status[0].toUpperCase() + status.slice(1);
}

export default async function ReclamationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const raw = (await searchParams).status;
  const status = FILTERS.find((filter) => filter.value === raw)?.value;
  const reclamations = await api.listReclamations(status);

  return (
    <div className={styles.layout}>
      <section className={`${ui.card} ${styles.listCard}`}>
        <div className={styles.pageHead}>
          <div>
            <p className={styles.eyebrow}>Support</p>
            <h1 className={styles.pageTitle}>Reclamations</h1>
          </div>
          <p className={styles.pageContext}>Questions and issues sent to the Ordely team</p>
        </div>
        <nav className={styles.filters} aria-label="Filter reclamations by status">
          {FILTERS.map((filter) => (
            <Link
              key={filter.label}
              href={filter.value ? `/reclamations?status=${filter.value}` : "/reclamations"}
              className={styles.filter}
              aria-current={filter.value === status ? "page" : undefined}
            >
              {filter.label}
            </Link>
          ))}
        </nav>
        {reclamations.length === 0 ? (
          <p className={ui.empty}>No reclamations in this view.</p>
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead><tr><th>Subject</th><th>Status</th><th>Order</th><th>Sent</th></tr></thead>
              <tbody>
                {reclamations.map((reclamation) => (
                  <tr key={reclamation.id}>
                    <td className={ui.strong}><Link href={`/reclamations/${reclamation.id}`}>{reclamation.subject}</Link></td>
                    <td><span className={`${styles.status} ${styles[reclamation.status]}`}>{statusLabel(reclamation.status)}</span></td>
                    <td className={ui.muted}>{reclamation.order ? `#${reclamation.order.id}` : "—"}</td>
                    <td className={ui.muted}>{formatDateTime(reclamation.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ReclamationForm />
    </div>
  );
}