import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import type { CallStatus, CallWithOrder } from "@/lib/api";
import { formatDuration, formatTND } from "@/lib/format";
import styles from "./call-logs.module.css";

const MAX_ATTEMPTS = 3;

const LOOK: Record<CallStatus, { icon: IconName; label: string; color: string; bg: string }> = {
  confirmed: { icon: "check", label: "Confirmed", color: "var(--success-text)", bg: "var(--success-bg)" },
  failed: { icon: "xCircle", label: "Failed", color: "var(--fail-text)", bg: "var(--fail-bg)" },
  no_answer: { icon: "phoneOff", label: "No answer", color: "var(--neutral-text)", bg: "var(--neutral-bg)" },
  pending: { icon: "clock", label: "Pending", color: "var(--pending-text)", bg: "var(--pending-bg)" },
};

export default function CallDetail({ call }: { call: (CallWithOrder & { attempts: number }) | null }) {
  if (!call) {
    return (
      <aside className={`${ui.card} ${styles.detail}`}>
        <h2 className={styles.detailTitle}>Call Detail</h2>
        <p className={ui.muted}>Select a call to see its details.</p>
      </aside>
    );
  }

  const look = LOOK[call.status];
  const reply = call.transcript?.findLast((l) => l.speaker === "customer");

  return (
    <aside className={`${ui.card} ${styles.detail}`}>
      <h2 className={styles.detailTitle}>Call Detail</h2>
      <div className={styles.detailHead}>
        <span className={styles.statusIcon} style={{ color: look.color, background: look.bg }}>
          <Icon name={look.icon} size={30} />
        </span>
        <h3>
          <Link href={`/orders/${call.order.id}`}>Order #{call.order.id}</Link> — {look.label}
        </h3>
        <p>
          {call.order.customer} · {call.order.phone || "no phone"}
        </p>
      </div>

      <dl className={styles.facts}>
        <dt>Duration</dt>
        <dd>{formatDuration(call.durationSeconds)}</dd>
        <dt>Language</dt>
        <dd>{call.language ?? "—"}</dd>
        <dt>Attempts</dt>
        <dd>
          {call.attempt} / {Math.max(MAX_ATTEMPTS, call.attempts)}
        </dd>
        <dt>Order value</dt>
        <dd>{formatTND(call.order.total)}</dd>
      </dl>

      {call.transcript && call.transcript.length > 0 ? (
        <div className={styles.transcript}>
          <h4>Transcript</h4>
          {call.transcript.map((line, i) => (
            <p
              key={i}
              dir="auto"
              className={
                line.speaker === "customer"
                  ? call.status === "confirmed"
                    ? styles.customerYes
                    : styles.customerNo
                  : undefined
              }
            >
              “{line.text}”
            </p>
          ))}
        </div>
      ) : (
        <p className={ui.muted}>
          {call.status === "pending"
            ? "This call is queued and hasn't been placed yet."
            : call.status === "no_answer"
              ? "The customer didn't pick up."
              : "No transcript available."}
        </p>
      )}

      {call.recordingUrl ? (
        <>
          <span className={styles.recording}>
            <Icon name="play" size={18} /> Play recording
          </span>
          <audio className={styles.audio} controls preload="none" src={call.recordingUrl} />
        </>
      ) : (
        reply !== undefined || call.status !== "pending" ? (
          <p className={styles.noRecording}>No recording available for this call.</p>
        ) : null
      )}
    </aside>
  );
}
