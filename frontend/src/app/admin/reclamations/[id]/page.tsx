import Link from "next/link";
import { notFound } from "next/navigation";
import ui from "@/components/app/ui.module.css";
import { ApiError, type ReclamationStatus } from "@/lib/api";
import { adminApi } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import styles from "@/components/admin/admin.module.css";
import local from "../reclamations.module.css";
import { updateReclamationStatus } from "../actions";

const STATUSES: { value: ReclamationStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

export default async function AdminReclamation({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const reclamation = await adminApi.reclamation(id).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  return (
    <>
      <Link href="/admin/reclamations" className={styles.back}>Back to reclamations</Link>
      <section className={`${ui.card} ${styles.card} ${local.detailCard}`}>
        <div className={local.detailHead}>
          <div><p className={local.eyebrow}>Reclamation #{reclamation.id}</p><h1 className={styles.head}>{reclamation.subject}</h1></div>
          <span className={`${local.status} ${local[reclamation.status]}`}>{STATUSES.find((s) => s.value === reclamation.status)?.label}</span>
        </div>
        <dl className={local.facts}>
          <dt>Merchant</dt><dd>{reclamation.boutique?.name ?? "Unnamed shop"} · {reclamation.user.email}</dd>
          <dt>Received</dt><dd>{formatDateTime(reclamation.createdAt)}</dd>
          <dt>Order</dt><dd>{reclamation.order ? `#${reclamation.order.id} · ${reclamation.order.customer}` : "—"}</dd>
        </dl>
        <div className={local.description}>{reclamation.description}</div>
        <form action={updateReclamationStatus} className={local.statusForm}>
          <input type="hidden" name="id" value={reclamation.id} />
          <label className={ui.field}>Status<select name="status" defaultValue={reclamation.status} className={ui.input}>{STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          <button type="submit" className={ui.btn}>Save status</button>
        </form>
      </section>
    </>
  );
}