import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { CallNowButton } from "@/components/app/CallButtons";
import ui from "@/components/app/ui.module.css";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, formatDuration, formatTND } from "@/lib/format";
import { deleteOrder, setOrderStatus } from "../actions";
import styles from "../orders.module.css";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();

  const order = await api.getOrder(id).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });
  const queued = order.calls.some((c) => c.status === "pending");

  return (
    <>
      <Link href="/orders" className={styles.back}>
        <Icon name="chevronLeft" size={16} /> Back to orders
      </Link>
      <div className={styles.detailGrid}>
        <section className={`${ui.card} ${ui.cardPad}`}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>Order #{order.id}</h2>
            <StatusBadge status={order.status} />
          </div>
          <dl className={styles.facts}>
            <dt>Customer</dt>
            <dd>{order.customer}</dd>
            <dt>Phone</dt>
            <dd>{order.phone || "—"}</dd>
            <dt>Item</dt>
            <dd>
              {order.item} × {order.quantity}
            </dd>
            <dt>Total</dt>
            <dd>{formatTND(order.total)}</dd>
            <dt>Placed</dt>
            <dd>{formatDateTime(order.createdAt)}</dd>
          </dl>
          <div className={styles.actions}>
            {order.status === "pending" && <CallNowButton orderId={order.id} queued={queued} />}
            {order.status !== "confirmed" && (
              <form action={setOrderStatus.bind(null, order.id, "confirmed")}>
                <button type="submit" className={ui.btnGhost}>
                  Mark confirmed
                </button>
              </form>
            )}
            {order.status !== "cancelled" && (
              <form action={setOrderStatus.bind(null, order.id, "cancelled")}>
                <button type="submit" className={ui.btnGhost}>
                  Cancel order
                </button>
              </form>
            )}
            <form action={deleteOrder.bind(null, order.id)}>
              <button type="submit" className={`${ui.btnGhost} ${styles.danger}`}>
                <Icon name="trash" size={16} /> Delete
              </button>
            </form>
          </div>
        </section>

        <section className={`${ui.card} ${ui.cardPad}`}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>Confirmation calls</h2>
          </div>
          {order.calls.length === 0 ? (
            <p className={ui.muted}>No calls yet for this order.</p>
          ) : (
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Attempt</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Language</th>
                  </tr>
                </thead>
                <tbody>
                  {order.calls.map((call) => (
                    <tr key={call.id}>
                      <td>
                        <Link href={`/call-logs?range=all&search=${order.id}&call=${call.id}`}>
                          #{call.attempt}
                        </Link>
                      </td>
                      <td className={ui.muted}>{formatDateTime(call.createdAt)}</td>
                      <td>
                        <StatusBadge status={call.status} />
                      </td>
                      <td className={ui.muted}>{formatDuration(call.durationSeconds)}</td>
                      <td className={ui.muted}>{call.language ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
