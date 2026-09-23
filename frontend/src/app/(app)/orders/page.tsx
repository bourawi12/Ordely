import Link from "next/link";
import NewOrderForm from "@/components/NewOrderForm";
import StatusBadge from "@/components/StatusBadge";
import ui from "@/components/app/ui.module.css";
import { api } from "@/lib/api";
import { formatDateTime, formatTND } from "@/lib/format";
import styles from "./orders.module.css";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await api.listOrders();

  return (
    <div className={styles.layout}>
      <section className={`${ui.card} ${styles.tableCard}`}>
        {orders.length === 0 ? (
          <p className={ui.empty}>No orders yet. Create one to get started.</p>
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
