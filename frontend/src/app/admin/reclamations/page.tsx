import Link from "next/link";
import ui from "@/components/app/ui.module.css";
import { Empty } from "@/components/admin/charts";
import PageHead from "@/components/admin/PageHead";
import styles from "@/components/admin/admin.module.css";
import { adminApi } from "@/lib/admin-api";
import type { ReclamationStatus } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import local from "./reclamations.module.css";

const FILTERS: { value?: ReclamationStatus; label: string }[] = [
  { label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

function statusLabel(status: ReclamationStatus) {
  return status === "in_progress" ? "In progress" : status[0].toUpperCase() + status.slice(1);
}

export default async function AdminReclamations({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const raw = (await searchParams).status;
  const status = FILTERS.find((filter) => filter.value === raw)?.value;
  const reclamations = await adminApi.reclamations({ status });

  return (
    <>
      <PageHead title="Reclamations" subtitle="Merchant issues requiring the Ordely team&apos;s attention." />
      <section className={`${ui.card} ${styles.card}`}>
        <nav className={local.filters} aria-label="Filter reclamations by status">
          {FILTERS.map((filter) => (
            <Link key={filter.label} href={filter.value ? `/admin/reclamations?status=${filter.value}` : "/admin/reclamations"} className={local.filter} aria-current={filter.value === status ? "page" : undefined}>
              {filter.label}
            </Link>
          ))}
        </nav>
        {reclamations.length === 0 ? <Empty>No reclamations in this view.</Empty> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Subject</th><th>Merchant</th><th>Status</th><th>Order</th><th>Received</th></tr></thead>
              <tbody>
                {reclamations.map((reclamation) => (
                  <tr key={reclamation.id}>
                    <td><Link href={`/admin/reclamations/${reclamation.id}`} className={styles.rowLink}>{reclamation.subject}</Link></td>
                    <td>{reclamation.boutique?.name ?? "Unnamed shop"}<span className={styles.sub}>{reclamation.user.email}</span></td>
                    <td><span className={`${local.status} ${local[reclamation.status]}`}>{statusLabel(reclamation.status)}</span></td>
                    <td>{reclamation.order ? `#${reclamation.order.id}` : "—"}</td>
                    <td>{formatDateTime(reclamation.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}