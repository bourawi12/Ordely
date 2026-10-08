import Link from "next/link";
import CsvImportForm from "@/components/CsvImportForm";
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
  { value: "unreachable", label: "Unreachable" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const raw = (await searchParams).status;
  const status = FILTERS.find((f) => f.value && f.value === raw)?.value;
  const orders = await api.listOrders(status);
  const totalValue = orders.reduce((sum, order) => sum + Number(order.total), 0);
  const totalCalls = orders.reduce((sum, order) => sum + (order.callCount ?? 0), 0);
  const pendingCount = orders.filter((order) => order.status === "pending").length;

  return (
    <div className={styles.layout}>
      <section className={`${ui.card} ${styles.tableCard}`}>
        <div className={styles.pageHead}>
          <div>
            <p className={styles.eyebrow}>Order queue</p>
            <h1 className={styles.pageTitle}>Orders</h1>
          </div>
          <p className={styles.pageContext}>
            {status ? `${status[0].toUpperCase()}${status.slice(1)} orders` : "All orders"}
          </p>
        </div>
        <div className={styles.summaryGrid} aria-label="Order summary">
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Visible orders</span>
            <strong className={styles.summaryValue}>{orders.length}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Awaiting confirmation</span>
            <strong className={styles.summaryValue}>{pendingCount}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Order value</span>
            <strong className={styles.summaryValue}>{formatTND(totalValue)}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Call attempts</span>
            <strong className={styles.summaryValue}>{totalCalls}</strong>
          </div>
        </div>
        <div className={styles.headerRow}>
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
          <div className={styles.headerActions}>
            <NewOrderForm />
            <CsvImportForm />
          </div>
        </div>
        {orders.length === 0 ? (
          <p className={ui.empty}>
            {status ? `No ${status} orders.` : "No orders yet. Create one or import a CSV to get started."}
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
                  <th>Calls</th>
                  <th>Next call</th>
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
                      {order.items && order.items.length > 0 ? (
                        <div className={styles.itemList}>
                          {order.items.slice(0, 2).map((item, idx) => (
                            <div key={item.id || idx}>
                              {item.productName}
                              <span className={ui.muted}> × {item.quantity}</span>
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <span className={`${ui.muted} ${styles.moreItems}`}>
                              +{order.items.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={ui.strong}>{formatTND(order.total)}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className={ui.muted}>{order.callCount ?? 0}</td>
                    <td>
                      {order.nextCallAt ? (
                        <span className={styles.nextCall}>{formatDateTime(order.nextCallAt)}</span>
                      ) : (
                        <span className={ui.muted}>—</span>
                      )}
                    </td>
                    <td className={ui.muted}>{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

