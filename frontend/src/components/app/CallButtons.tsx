"use client";

import { useActionState } from "react";
import Icon from "@/components/Icon";
import { queueAllPending, queueCall, type QueueState } from "@/app/(app)/call-logs/actions";
import styles from "./ui.module.css";

export function CallNowButton({ orderId, queued }: { orderId: number; queued: boolean }) {
  const [state, action, pending] = useActionState<QueueState>(
    () => queueCall(orderId),
    {},
  );
  const isQueued = queued || Boolean(state.message);

  return (
    <form action={action}>
      <button
        type="submit"
        className={styles.btnSoft}
        disabled={pending || isQueued}
        title={state.error}
      >
        {isQueued ? "Queued" : pending ? "Queuing…" : "Call now"}
      </button>
    </form>
  );
}

export function CallAllPendingButton({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState<QueueState>(queueAllPending, {});

  return (
    <form action={action} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      {(state.message || state.error) && (
        <span className={state.error ? styles.error : styles.muted} role="status">
          {state.error ?? state.message}
        </span>
      )}
      <button type="submit" className={styles.btn} disabled={pending || disabled}>
        <Icon name="phoneCall" size={18} />
        {pending ? "Queuing…" : "Call all pending"}
      </button>
    </form>
  );
}
