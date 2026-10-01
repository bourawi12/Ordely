import Link from "next/link";
import NewOrderForm from "@/components/NewOrderForm";
import StatusBadge from "@/components/StatusBadge";
import ui from "@/components/app/ui.module.css";
import { api, type OrderStatus } from "@/lib/api";
import { formatDateTime, formatTND } from "@/lib/format";
import styles from "./orders.module.css";

export const dynamic = "force-dynamic";

const FILTERS: { value?: OrderStatus; label: string }[] = [
  { label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const raw = (await searchParams).status;
  const status = FILTERS.find((f) => f.value && f.value === raw)?.value;
  const orders = await api.listOrders(status);

  return (
    <div className={styles.layout}>
      <section className={`${ui.card} ${styles.tableCard}`}>
        <nav className={styles.tabs} aria-label="Filter by status">
          {FILTERS.map((f) => (
            <Link
              key={f.label}
              href={f.value ? `/orders?status=${f.value}` : "/orders"}
              className={styles.tab}
              aria-current={f.value === status ? "page" : undefined}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {orders.length === 0 ? (
          <p className={ui.empty}>
            {status ? `No ${status} orders.` : "No orders yet. Create one to get started."}
          </p>
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Item</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className={ui.strong}>
                      <Link href={`/orders/${order.id}`}>#{order.id}</Link>
                    </td>
                    <td>{order.customer}</td>
                    <td className={ui.muted}>{order.phone || "—"}</td>
                    <td>
                      {order.item}
                      {order.quantity > 1 && <span className={ui.muted}> × {order.quantity}</span>}
                    </td>
                    <td className={ui.strong}>{formatTND(order.total)}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className={ui.muted}>{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <NewOrderForm />
    </div>
  );
}
