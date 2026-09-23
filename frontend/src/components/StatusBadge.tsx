import styles from "@/components/app/ui.module.css";
import type { CallStatus, OrderStatus } from "@/lib/api";

const LABELS: Record<CallStatus | OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  failed: "Failed",
  no_answer: "No-answer",
  cancelled: "Cancelled",
};

export default function StatusBadge({ status }: { status: CallStatus | OrderStatus }) {
  return <span className={`${styles.badge} ${styles[status]}`}>{LABELS[status]}</span>;
}
