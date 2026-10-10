import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { CallNowButton, RetryCallButton } from "@/components/app/CallButtons";
import ui from "@/components/app/ui.module.css";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, formatDuration, formatTND } from "@/lib/format";
import { deleteOrder, setOrderStatus } from "../actions";
import EditableOrder from "./edit-order";
import styles from "../orders.module.css";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();

  const order = await api.getOrder(id).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });
  const queued = order.calls.some((c) => c.status === "pending");
  const needsReview = order.calls.some((c) => c.disposition === "needs_human");

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
          {needsReview && (
            <div className={styles.reviewBanner} role="status">
              <strong>Needs review</strong>
              <span>
                Three attempts ended without a clear customer decision. You can
                ask Ordely to try again.
              </span>
            </div>
          )}
          <EditableOrder order={order}>
            <dl className={styles.facts}>
              <dt>Customer</dt>
              <dd>{order.customer}</dd>
              <dt>Phone</dt>
              <dd>{order.phone || "—"}</dd>
              <dt>Items</dt>
              <dd>
                {order.items && order.items.length > 0 ? (
                  order.items.map((item, idx) => (
                    <div key={item.id || idx}>
                      {item.productName} × {item.quantity}
                    </div>
                  ))
                ) : (
                  "—"
                )}
              </dd>
              <dt>Total</dt>
              <dd>{formatTND(order.total)}</dd>
              <dt>Placed</dt>
              <dd>{formatDateTime(order.createdAt)}</dd>
              <dt>Call attempts</dt>
              <dd>{order.calls.length} / 3</dd>
            </dl>
          </EditableOrder>
          <div className={styles.actions}>
            {order.status === "pending" && (
              <CallNowButton orderId={order.id} queued={queued} />
            )}
            {order.status === "unreachable" && (
              <RetryCallButton orderId={order.id} />
            )}
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
              <button
                type="submit"
                className={`${ui.btnGhost} ${styles.danger}`}
              >
                <Icon name="trash" size={16} /> Delete
              </button>
            </form>
          </div>
        </section>

        <section className={`${ui.card} ${ui.cardPad}`}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>Activity timeline</h2>
          </div>
          {order.calls.length === 0 ? (
            <p className={ui.muted}>Order created. No confirmation call has been queued yet.</p>
          ) : (
            <ol className={styles.timeline}>
              <li className={styles.timelineItem}>
                <span className={styles.timelineDot} aria-hidden="true" />
                <div>
                  <strong>Order created</strong>
                  <p>{formatDateTime(order.createdAt)}</p>
                </div>
              </li>
              {order.calls.map((call) => (
                <li key={call.id} className={styles.timelineItem}>
                  <span className={styles.timelineDot} aria-hidden="true" />
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineHead}>
                      <Link href={`/call-logs?range=all&search=${order.id}&call=${call.id}`}>
                        <strong>Confirmation attempt {call.attempt}</strong>
                      </Link>
                      <StatusBadge status={call.status} />
                    </div>
                    <p>{formatDateTime(call.createdAt)} · {call.dispatchedAt ? `started ${formatDateTime(call.dispatchedAt)}` : "not started"}</p>
                    <span className={ui.muted}>
                      {call.disposition?.replaceAll("_", " ") ?? "No outcome yet"} · {formatDuration(call.durationSeconds)} · {call.language ?? "Darija"}
                    </span>
                    {call.failureReason && <span className={styles.timelineReason}>{call.failureReason}</span>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
