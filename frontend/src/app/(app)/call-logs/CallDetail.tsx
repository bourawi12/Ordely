import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import type { CallDetail as Detail, CallStatus } from "@/lib/api";
import { formatDateTime, formatDuration, formatTND } from "@/lib/format";
import styles from "./call-logs.module.css";

const MAX_ATTEMPTS = 3;

const LOOK: Record<CallStatus, { icon: IconName; label: string; color: string; bg: string }> = {
  confirmed: { icon: "check", label: "Confirmed", color: "var(--success-text)", bg: "var(--success-bg)" },
  failed: { icon: "xCircle", label: "Failed", color: "var(--fail-text)", bg: "var(--fail-bg)" },
  no_answer: { icon: "phoneOff", label: "No answer", color: "var(--neutral-text)", bg: "var(--neutral-bg)" },
  pending: { icon: "clock", label: "Pending", color: "var(--pending-text)", bg: "var(--pending-bg)" },
};

export default function CallDetail({ call }: { call: Detail | null }) {
  if (!call) {
    return (
      <aside className={`${ui.card} ${styles.detail}`}>
        <h2 className={styles.detailTitle}>Call Detail</h2>
        <p className={ui.muted}>Select a call to see its details.</p>
      </aside>
    );
  }

  const look = LOOK[call.status];
  const statusLabel =
    call.disposition === "policy_blocked"
      ? "Not applied"
      : call.disposition === "needs_human"
      ? "Needs review"
      : call.disposition === "ambiguous"
        ? "Unclear, retrying"
        : look.label;
  const reply = call.transcript?.findLast((l) => l.speaker === "customer");

  return (
    <aside className={`${ui.card} ${styles.detail}`}>
      <h2 className={styles.detailTitle}>Call Detail</h2>
      <div className={styles.detailHead}>
        <span className={styles.statusIcon} style={{ color: look.color, background: look.bg }}>
          <Icon name={look.icon} size={30} />
        </span>
        <h3>
          <Link href={`/orders/${call.order.id}`}>Order #{call.order.id}</Link> — {statusLabel}
        </h3>
        <p>
          {call.order.customer} · {call.order.phone || "no phone"}
        </p>
      </div>

      {call.failureReason && <p className={ui.muted}>{call.failureReason}</p>}

      <dl className={styles.facts}>
        <dt>Duration</dt>
        <dd>{formatDuration(call.durationSeconds)}</dd>
        <dt>Queued</dt>
        <dd>{formatDateTime(call.createdAt)}</dd>
        <dt>Started</dt>
        <dd>{call.dispatchedAt ? formatDateTime(call.dispatchedAt) : "—"}</dd>
        <dt>Completed</dt>
        <dd>{call.completedAt ? formatDateTime(call.completedAt) : "—"}</dd>
        <dt>Language</dt>
        <dd>{call.language ?? "—"}</dd>
        <dt>Attempts</dt>
        <dd>
          {call.attempt} / {Math.max(MAX_ATTEMPTS, call.attempts)}
        </dd>
        <dt>Order value</dt>
        <dd>{formatTND(call.order.total)}</dd>
        <dt>Transport</dt>
        <dd>{call.transportPhase ?? "—"}</dd>
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

      {call.recordings?.customer && call.recordings.agent ? (
        // Voice agent calls: one recording per side of the conversation.
        <>
          <span className={styles.recording}>
            <Icon name="play" size={18} /> Customer
          </span>
          <audio className={styles.audio} controls preload="none" src={call.recordings.customer} />
          <span className={styles.recording}>
            <Icon name="play" size={18} /> Agent
          </span>
          <audio className={styles.audio} controls preload="none" src={call.recordings.agent} />
        </>
      ) : call.recordingUrl ? (
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
