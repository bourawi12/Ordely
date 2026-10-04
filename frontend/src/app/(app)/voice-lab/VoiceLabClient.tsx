"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Icon from "@/components/Icon";
import type { CallWithOrder } from "@/lib/api";
import { formatClock, formatDateTime, formatDuration, formatTND } from "@/lib/format";
import {
  createTestOrderAndQueueAction,
  dispatchCallAction,
  getCallDetailsAction,
  getRecordingUrlAction,
} from "./actions";
import styles from "./voice-lab.module.css";

interface VoiceLabClientProps {
  initialCalls: CallWithOrder[];
  initialSelectedCall: (CallWithOrder & { attempts: number }) | null;
}

export default function VoiceLabClient({
  initialCalls,
  initialSelectedCall,
}: VoiceLabClientProps) {
  const [calls, setCalls] = useState<CallWithOrder[]>(initialCalls);
  const [selectedCall, setSelectedCall] = useState<(CallWithOrder & { attempts: number }) | null>(
    initialSelectedCall,
  );
  const [selectedId, setSelectedId] = useState<number | null>(
    initialSelectedCall?.id ?? initialCalls[0]?.id ?? null,
  );

  // Audio signed URLs
  const [agentAudioUrl, setAgentAudioUrl] = useState<string | null>(null);
  const [customerAudioUrl, setCustomerAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  // Polling toggle
  const [isPolling, setIsPolling] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Test form state
  const [customerName, setCustomerName] = useState("Amine Mansour");
  const [phone, setPhone] = useState("+216 98 123 456");
  const [item, setItem] = useState("Montre Connectée Sport Pro");
  const [quantity, setQuantity] = useState(1);
  const [total, setTotal] = useState(129.9);
  const [autoDispatch, setAutoDispatch] = useState(true);

  // Status message
  const [statusNotice, setStatusNotice] = useState<{ text: string; type: "success" | "error" } | null>(
    null,
  );

  // Fetch full details of the currently selected call
  const refreshSelectedCall = useCallback(async (callId: number) => {
    const res = await getCallDetailsAction(callId);
    if (res.success && res.call) {
      setSelectedCall(res.call);
      setCalls((prev) =>
        prev.map((c) => (c.id === callId ? { ...c, ...res.call } : c)),
      );
    }
  }, []);

  // Handle call selection
  const handleSelectCall = (callId: number) => {
    setSelectedId(callId);
    setAgentAudioUrl(null);
    setCustomerAudioUrl(null);
    startTransition(async () => {
      await refreshSelectedCall(callId);
    });
  };

  // Fetch audio signed URLs when selected call has recordings
  useEffect(() => {
    if (!selectedCall) return;

    const fetchRecordings = async () => {
      setLoadingAudio(true);
      try {
        const hasAgent = selectedCall.recordings?.some((r) => r.speaker === "agent");
        const hasCustomer = selectedCall.recordings?.some((r) => r.speaker === "customer");

        if (hasAgent) {
          const agentRes = await getRecordingUrlAction(selectedCall.id, "agent");
          if (agentRes.success && agentRes.url) {
            setAgentAudioUrl(agentRes.url);
          }
        } else {
          setAgentAudioUrl(null);
        }

        if (hasCustomer) {
          const custRes = await getRecordingUrlAction(selectedCall.id, "customer");
          if (custRes.success && custRes.url) {
            setCustomerAudioUrl(custRes.url);
          }
        } else {
          setCustomerAudioUrl(null);
        }
      } finally {
        setLoadingAudio(false);
      }
    };

    fetchRecordings();
  }, [selectedCall]);

  // Live polling effect
  useEffect(() => {
    if (!isPolling || !selectedId) return;

    const interval = setInterval(() => {
      refreshSelectedCall(selectedId);
    }, 2500);

    return () => clearInterval(interval);
  }, [isPolling, selectedId, refreshSelectedCall]);

  // Handle manual dispatch
  const handleDispatch = (callId: number) => {
    setStatusNotice(null);
    startTransition(async () => {
      const res = await dispatchCallAction(callId);
      if (res.success) {
        setStatusNotice({
          text: `Call #${callId} dispatched to Ringio Voice Agent successfully!`,
          type: "success",
        });
        await refreshSelectedCall(callId);
      } else {
        setStatusNotice({
          text: res.error || "Failed to dispatch call",
          type: "error",
        });
      }
    });
  };

  // Handle quick test order creation
  const handleCreateTestOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusNotice(null);
    startTransition(async () => {
      const res = await createTestOrderAndQueueAction({
        customer: customerName,
        phone,
        item,
        quantity: Number(quantity),
        total: Number(total),
        autoDispatch,
      });

      if (res.success && res.callId) {
        setStatusNotice({
          text: `Order created and Call #${res.callId} queued${autoDispatch ? " & dispatched to Ringio!" : "!"}`,
          type: "success",
        });
        setSelectedId(res.callId);
        await refreshSelectedCall(res.callId);
      } else {
        setStatusNotice({
          text: res.error || "Failed to create order and call",
          type: "error",
        });
      }
    });
  };

  const getPhaseClass = (phase?: string | null) => {
    switch (phase) {
      case "dispatched":
        return styles.phaseDispatched;
      case "ringing":
      case "connecting":
      case "dialing":
        return styles.phaseRinging;
      case "live":
      case "greeting":
        return styles.phaseLive;
      case "ended":
        return styles.phaseEnded;
      case "rejected":
      case "error":
        return styles.phaseError;
      default:
        return "";
    }
  };

  const getDispositionClass = (disp?: string | null) => {
    switch (disp) {
      case "confirmed":
        return styles.dispConfirmed;
      case "declined":
      case "error":
        return styles.dispDeclined;
      case "needs_human":
      case "ambiguous":
        return styles.dispNeedsHuman;
      case "no_answer":
        return styles.dispNoAnswer;
      default:
        return "";
    }
  };

  const isActivePhase = (phase?: string | null) => {
    return ["dispatched", "ringing", "connecting", "dialing", "greeting", "live"].includes(
      phase ?? "",
    );
  };

  return (
    <div className={styles.container}>
      {/* Top Header & Developer Ribbon */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Voice Lab & Telemetry Studio</h1>
            <span className={styles.badgeHidden}>
              <Icon name="shield" size={12} />
              Hidden Test Route
            </span>
          </div>
          <p className={styles.desc}>
            Interactive workbench for dispatching confirmation calls to the Ringio Gemini agent,
            monitoring live transport phases, and inspecting dual-track audio & transcripts.
          </p>
        </div>

        <div className={styles.headerActions}>
          <label className={styles.pollToggle} title="Poll every 2.5s for live call updates">
            <input
              type="checkbox"
              checked={isPolling}
              onChange={(e) => setIsPolling(e.target.checked)}
            />
            {isPolling && <span className={styles.pulseDot} />}
            <span>Live Polling</span>
          </label>

          <button
            type="button"
            className={styles.pollToggle}
            onClick={() => selectedId && refreshSelectedCall(selectedId)}
            disabled={isPending}
            title="Refresh current call"
          >
            <Icon name="history" size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Notice Banner */}
      {statusNotice && (
        <div
          className={statusNotice.type === "error" ? styles.errorBanner : styles.header}
          style={
            statusNotice.type === "success"
              ? {
                  background: "var(--success-bg)",
                  color: "var(--success-text)",
                  border: "1px solid var(--border)",
                  padding: "0.85rem 1.25rem",
                }
              : {}
          }
        >
          <Icon name={statusNotice.type === "success" ? "check" : "shield"} size={18} />
          <span>{statusNotice.text}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className={styles.layout}>
        {/* Left Sidebar: Generator & Calls List */}
        <aside className={styles.sidebar}>
          {/* Quick Test Call Generator */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Quick Test Call Generator</h2>
              <span className={styles.badgePhase}>Test Utility</span>
            </div>
            <div className={styles.cardBody}>
              <form onSubmit={handleCreateTestOrder} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="vl-customer">Customer Name</label>
                  <input
                    id="vl-customer"
                    className={styles.input}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="vl-phone">Phone Number (Destination)</label>
                  <input
                    id="vl-phone"
                    className={styles.input}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="vl-item">Product Item</label>
                  <input
                    id="vl-item"
                    className={styles.input}
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label htmlFor="vl-qty">Quantity</label>
                    <input
                      id="vl-qty"
                      type="number"
                      min={1}
                      className={styles.input}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="vl-total">Total (TND)</label>
                    <input
                      id="vl-total"
                      type="number"
                      step="0.001"
                      className={styles.input}
                      value={total}
                      onChange={(e) => setTotal(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={autoDispatch}
                    onChange={(e) => setAutoDispatch(e.target.checked)}
                  />
                  <span>Dispatch immediately to Ringio agent</span>
                </label>

                <button
                  type="submit"
                  disabled={isPending}
                  className={styles.btnSubmit}
                >
                  <Icon name="phone" size={16} />
                  <span>{isPending ? "Generating..." : "Queue Test Call"}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Calls Queue & Recent Calls List */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Recent Calls ({calls.length})</h2>
              <span className={styles.telemetryLabel}>Tenant Scoped</span>
            </div>

            <div className={styles.queueList}>
              {calls.length === 0 ? (
                <div className={styles.emptyState}>
                  <Icon name="phone" size={32} className={styles.emptyIcon} />
                  <p className={styles.emptyText}>No confirmation calls found yet.</p>
                </div>
              ) : (
                calls.map((c) => {
                  const isSelected = c.id === selectedId;
                  const canDispatch =
                    c.status === "pending" && (!c.taskId || c.transportPhase === "rejected");

                  return (
                    <div
                      key={c.id}
                      className={`${styles.callItem} ${isSelected ? styles.callItemActive : ""}`}
                      onClick={() => handleSelectCall(c.id)}
                    >
                      <div className={styles.callItemTop}>
                        <span className={styles.callItemTitle}>
                          Call #{c.id} · Order #{c.order?.id}
                        </span>
                        <span
                          className={`${styles.badgePhase} ${getPhaseClass(c.transportPhase)}`}
                        >
                          {c.transportPhase ?? c.status}
                        </span>
                      </div>

                      <div className={styles.callItemMeta}>
                        <span>{c.order?.customer}</span>
                        <span>·</span>
                        <span>{c.order?.total ? formatTND(c.order.total) : "—"}</span>
                        <span>·</span>
                        <span>{formatClock(c.createdAt)}</span>
                      </div>

                      <div className={styles.callItemActions}>
                        {c.disposition && (
                          <span
                            className={`${styles.badgeDisposition} ${getDispositionClass(c.disposition)}`}
                          >
                            {c.disposition}
                          </span>
                        )}

                        {canDispatch && (
                          <button
                            type="button"
                            className={styles.btnDispatchMini}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDispatch(c.id);
                            }}
                            disabled={isPending}
                            title="Dispatch this call to Ringio agent"
                          >
                            <Icon name="arrow" size={12} />
                            Dispatch
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Right Panel: Active Studio & Telemetry */}
        <section className={styles.studio}>
          {selectedCall ? (
            <>
              {/* Call Status Ribbon */}
              <div className={styles.statusRibbon}>
                <div className={styles.ribbonLeft}>
                  <div className={styles.callIdBig}>
                    Call #{selectedCall.id}
                  </div>
                  <span
                    className={`${styles.badgePhase} ${getPhaseClass(selectedCall.transportPhase)}`}
                  >
                    {isActivePhase(selectedCall.transportPhase) && (
                      <span className={styles.pulseDot} />
                    )}
                    Phase: {selectedCall.transportPhase ?? "not dispatched"}
                  </span>
                  {selectedCall.disposition && (
                    <span
                      className={`${styles.badgeDisposition} ${getDispositionClass(selectedCall.disposition)}`}
                    >
                      Disposition: {selectedCall.disposition}
                    </span>
                  )}
                </div>

                {selectedCall.status === "pending" &&
                  (!selectedCall.taskId || selectedCall.transportPhase === "rejected") && (
                    <button
                      type="button"
                      className={styles.btnSubmit}
                      onClick={() => handleDispatch(selectedCall.id)}
                      disabled={isPending}
                    >
                      <Icon name="phone" size={16} />
                      Dispatch to Ringio
                    </button>
                  )}
              </div>

              {/* Error banner if failure reason exists */}
              {selectedCall.failureReason && (
                <div className={styles.errorBanner}>
                  <Icon name="shield" size={18} />
                  <span>Failure: {selectedCall.failureReason}</span>
                </div>
              )}

              {/* Correlation & Telemetry Card */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Correlation & Telemetry</h3>
                  <span className={styles.telemetryLabel}>DIP & SOLID Port</span>
                </div>
                <div className={styles.telemetryGrid}>
                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Task ID (UUID)</span>
                    <span className={styles.telemetryVal}>
                      {selectedCall.taskId ?? "— (awaiting dispatch)"}
                    </span>
                  </div>
                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Provider Call ID</span>
                    <span className={styles.telemetryVal}>
                      {selectedCall.providerCallId ?? "—"}
                    </span>
                  </div>
                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Attempt Count</span>
                    <span className={styles.telemetryVal}>
                      {selectedCall.attempt} (total {selectedCall.attempts})
                    </span>
                  </div>
                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Duration</span>
                    <span className={styles.telemetryVal}>
                      {formatDuration(selectedCall.durationSeconds)}
                    </span>
                  </div>
                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Dispatched At</span>
                    <span className={styles.telemetryVal}>
                      {selectedCall.dispatchedAt ? formatDateTime(selectedCall.dispatchedAt) : "—"}
                    </span>
                  </div>
                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Completed At</span>
                    <span className={styles.telemetryVal}>
                      {selectedCall.completedAt ? formatDateTime(selectedCall.completedAt) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dual-Track Audio Studio */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Dual-Track Audio Studio</h3>
                  <span className={styles.telemetryLabel}>MinIO WAV Storage</span>
                </div>

                <div className={styles.audioGrid}>
                  {/* AI Agent Track */}
                  <div className={styles.audioTrackCard}>
                    <div className={styles.audioTrackHead}>
                      <span className={styles.audioTrackTitle}>
                        <Icon name="headset" size={16} />
                        🤖 AI Agent Voice
                      </span>
                      <span className={styles.badgePhase}>48 kHz mono</span>
                    </div>

                    {loadingAudio ? (
                      <p className={styles.desc}>Signing audio URL...</p>
                    ) : agentAudioUrl ? (
                      <>
                        <audio
                          controls
                          src={agentAudioUrl}
                          className={styles.audioPlayer}
                          preload="metadata"
                        />
                        <div className={styles.audioTrackMeta}>
                          <span>Saved in MinIO</span>
                          <a
                            href={agentAudioUrl}
                            download={`call-${selectedCall.id}-agent.wav`}
                            className={styles.desc}
                            style={{ textDecoration: "underline" }}
                          >
                            Download WAV
                          </a>
                        </div>
                      </>
                    ) : (
                      <p className={styles.desc}>
                        No agent recording available yet. Will appear once the call ends.
                      </p>
                    )}
                  </div>

                  {/* Customer Track */}
                  <div className={styles.audioTrackCard}>
                    <div className={styles.audioTrackHead}>
                      <span className={styles.audioTrackTitle}>
                        <Icon name="phone" size={16} />
                        👤 Customer Voice
                      </span>
                      <span className={styles.badgePhase}>16 kHz mono</span>
                    </div>

                    {loadingAudio ? (
                      <p className={styles.desc}>Signing audio URL...</p>
                    ) : customerAudioUrl ? (
                      <>
                        <audio
                          controls
                          src={customerAudioUrl}
                          className={styles.audioPlayer}
                          preload="metadata"
                        />
                        <div className={styles.audioTrackMeta}>
                          <span>Saved in MinIO</span>
                          <a
                            href={customerAudioUrl}
                            download={`call-${selectedCall.id}-customer.wav`}
                            className={styles.desc}
                            style={{ textDecoration: "underline" }}
                          >
                            Download WAV
                          </a>
                        </div>
                      </>
                    ) : (
                      <p className={styles.desc}>
                        No customer recording available yet. Will appear once the call ends.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Real-time Conversation Transcript Stream */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>
                    Conversation Transcript (
                    {selectedCall.transcriptEntries?.length ??
                      selectedCall.transcript?.length ??
                      0}{" "}
                    lines)
                  </h3>
                  <span className={styles.telemetryLabel}>Live Stream</span>
                </div>

                <div className={styles.transcriptStream}>
                  {selectedCall.transcriptEntries && selectedCall.transcriptEntries.length > 0 ? (
                    selectedCall.transcriptEntries.map((entry) => {
                      const isAgent = entry.speaker === "agent";
                      return (
                        <div
                          key={entry.id ?? entry.sequence}
                          className={`${styles.bubble} ${
                            isAgent ? styles.bubbleAgent : styles.bubbleCustomer
                          }`}
                        >
                          <div className={styles.bubbleHeader}>
                            <span>{isAgent ? "🤖 AI Voice Agent" : "👤 Customer"}</span>
                            <span>{entry.timestamp ? formatClock(entry.timestamp) : ""}</span>
                          </div>
                          <p className={styles.bubbleText}>{entry.text}</p>
                        </div>
                      );
                    })
                  ) : selectedCall.transcript && selectedCall.transcript.length > 0 ? (
                    selectedCall.transcript.map((line, idx) => {
                      const isAgent = line.speaker === "agent";
                      return (
                        <div
                          key={idx}
                          className={`${styles.bubble} ${
                            isAgent ? styles.bubbleAgent : styles.bubbleCustomer
                          }`}
                        >
                          <div className={styles.bubbleHeader}>
                            <span>{isAgent ? "🤖 AI Voice Agent" : "👤 Customer"}</span>
                          </div>
                          <p className={styles.bubbleText}>{line.text}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className={styles.emptyState}>
                      <Icon name="history" size={28} className={styles.emptyIcon} />
                      <p className={styles.emptyText}>
                        {selectedCall.transportPhase === "dispatched" ||
                        selectedCall.transportPhase === "ringing" ||
                        selectedCall.transportPhase === "live"
                          ? "Call in progress... Transcripts will appear as speakers talk."
                          : "No transcript recorded for this call."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Raw State Inspector */}
              <div className={styles.card}>
                <details>
                  <summary className={styles.cardHeader} style={{ cursor: "pointer" }}>
                    <h3 className={styles.cardTitle}>Raw JSON Payload & Database Record</h3>
                    <span className={styles.telemetryLabel}>Click to expand</span>
                  </summary>
                  <div className={styles.cardBody}>
                    <pre className={styles.jsonInspector}>
                      {JSON.stringify(selectedCall, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            </>
          ) : (
            <div className={`${styles.card} ${styles.emptyState}`}>
              <Icon name="phone" size={48} className={styles.emptyIcon} />
              <h2 className={styles.cardTitle}>No Call Selected</h2>
              <p className={styles.emptyText}>
                Select a call from the list or create a new test call using the form on the left.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
