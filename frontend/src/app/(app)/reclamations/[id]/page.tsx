import Link from "next/link";
import { notFound } from "next/navigation";
import ui from "@/components/app/ui.module.css";
import { ApiError, api, type ReclamationStatus } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import styles from "../reclamations.module.css";

function statusLabel(status: ReclamationStatus) {
  return status === "in_progress" ? "In progress" : status[0].toUpperCase() + status.slice(1);
}

export default async function ReclamationDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const reclamation = await api.getReclamation(id).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  return (
    <section className={`${ui.card} ${styles.detailCard}`}>
      <Link href="/reclamations" className={styles.back}>Back to reclamations</Link>
      <div className={styles.detailHead}>
        <div><p className={styles.eyebrow}>Reclamation #{reclamation.id}</p><h1 className={styles.pageTitle}>{reclamation.subject}</h1></div>
        <span className={`${styles.status} ${styles[reclamation.status]}`}>{statusLabel(reclamation.status)}</span>
      </div>
      <p className={styles.detailMeta}>Sent {formatDateTime(reclamation.createdAt)}{reclamation.order ? ` · Order #${reclamation.order.id}` : ""}</p>
      <div className={styles.description}>{reclamation.description}</div>
      <p className={styles.detailNote}>The Ordely team will review your reclamation and update its status here.</p>
    </section>
  );
}