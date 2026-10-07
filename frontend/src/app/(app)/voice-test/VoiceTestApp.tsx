"use client";

import React, { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useRealtime } from "@/components/RealtimeProvider";
import ui from "@/components/app/ui.module.css";
import type { Order } from "@/lib/api";
import { formatTND } from "@/lib/format";
import styles from "./voice-test.module.css";

interface SpeechSegment {
  text: string;
  language: "fr" | "en" | "ar" | "tn";
}

interface TranscriptMessage {
  id: string;
  speaker: "AGENT" | "CUSTOMER";
  text: string;
  timestamp: string;
  segments?: SpeechSegment[];
}

type CallState = "IDLE" | "CONNECTING" | "ACTIVE" | "COMPLETED" | "ABORTED";

export default function VoiceTestApp({
  initialOrders,
}: {
  initialOrders: Order[];
}) {
  const { socket, connected } = useRealtime();

  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(
    initialOrders[0]?.id ?? null,
  );

  // Call state & metadata
  const [callState, setCallState] = useState<CallState>("IDLE");
  const [activeCallId, setActiveCallId] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [lastIntent, setLastIntent] = useState<string>("UNCLEAR");
  const [lastConfidence, setLastConfidence] = useState<number>(0);
  const [detectedLang, setDetectedLang] = useState<string>("FRENCH");

  // Audio capture state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0); // 0..100
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [textInput, setTextInput] = useState<string>("");
  const [infoMessage, setInfoMessage] = useState<string>("");
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState<boolean>(true);

  // Speech Recognition fallback & Audio elements
  const [speechLang, setSpeechLang] = useState<string>("fr-FR");
  const [isBrowserSttActive, setIsBrowserSttActive] = useState<boolean>(false);

  // Audio refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const lastTranscriptTimeRef = useRef<number>(0);

  // Log logger with timestamps
  const addDebugLog = (tag: string, detail?: string) => {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
    const logLine = `[${time}] [VOICE_DEBUG] ${tag}${detail ? `: ${detail}` : ""}`;
    console.log(logLine);
    setDebugLogs((prev) => [logLine, ...prev].slice(0, 50));
  };

  useEffect(() => {
    setOrders(initialOrders);
    if (!selectedOrderId && initialOrders.length > 0) {
      setSelectedOrderId(initialOrders[0].id);
    }
  }, [initialOrders, selectedOrderId]);

  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Duration timer
  useEffect(() => {
    if (callState === "ACTIVE") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (callState === "IDLE") setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // =========================================================================
  // MULTILINGUAL SPEECH SYNTHESIS (TTS)
  // Option A (Neural OpenAI audioBase64) + Option B (Segmented Browser Voices)
  // =========================================================================

  const playAgentResponseSpeech = (
    text: string,
    audioBase64?: string,
    segments?: SpeechSegment[],
  ) => {
    if (!ttsEnabled || typeof window === "undefined") return;

    // Stop existing audio playbacks
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    // Option A: Use pre-rendered Neural OpenAI Audio if available
    if (audioBase64) {
      addDebugLog("TTS_STARTED", "Playing Neural Multilingual Audio (OpenAI)");
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audioPlayerRef.current = audio;

      audio.onended = () => {
        addDebugLog("TTS_COMPLETED", "Neural audio playback finished");
      };
      audio.onerror = (e) => {
        addDebugLog("TTS_ERROR", "Neural audio error; falling back to segmented browser TTS");
        playSegmentedBrowserTTS(text, segments);
      };

      audio.play().catch((err) => {
        addDebugLog("TTS_ERROR", `Audio play blocked/failed: ${err.message}`);
        playSegmentedBrowserTTS(text, segments);
      });
      return;
    }

    // Option B: Segmented Browser Speech Synthesis Fallback
    playSegmentedBrowserTTS(text, segments);
  };

  const playSegmentedBrowserTTS = (text: string, segments?: SpeechSegment[]) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const segs = segments && segments.length > 0
      ? segments
      : [{ text, language: "fr" as const }];

    addDebugLog("TTS_SEGMENTS", `Synthesizing ${segs.length} language segments`);

    const voices = window.speechSynthesis.getVoices();
    let index = 0;

    const playNextSegment = () => {
      if (index >= segs.length) {
        addDebugLog("TTS_COMPLETED", "All segments finished speaking");
        return;
      }

      const seg = segs[index++];
      if (!seg.text.trim()) {
        playNextSegment();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(seg.text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      // Match language-specific voice
      let targetLang = "fr-FR";
      if (seg.language === "ar" || seg.language === "tn") {
        targetLang = "ar-TN";
      } else if (seg.language === "en") {
        targetLang = "en-US";
      }

      utterance.lang = targetLang;

      // Select voice matching language code
      const matchedVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith(targetLang.slice(0, 2).toLowerCase())) ||
        voices.find((v) => v.lang.toLowerCase().includes("arabic") || v.lang.toLowerCase().includes("french"));

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onend = () => {
        playNextSegment();
      };
      utterance.onerror = (e) => {
        addDebugLog("TTS_ERROR", `Segment error in [${seg.language}]: ${e.error}`);
        playNextSegment();
      };

      window.speechSynthesis.speak(utterance);
    };

    playNextSegment();
  };

  // =========================================================================
  // REAL MICROPHONE & AUDIO CAPTURE PIPELINE (getUserMedia + MediaRecorder)
  // =========================================================================

  const startMicrophoneAudio = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setInfoMessage("Microphone capture not supported in this browser.");
      addDebugLog("MICROPHONE_ERROR", "getUserMedia API missing");
      return;
    }

    try {
      addDebugLog("MICROPHONE_STARTING", "Requesting microphone permissions...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      mediaStreamRef.current = stream;
      const track = stream.getAudioTracks()[0];

      if (!track || track.readyState !== "live") {
        addDebugLog("MICROPHONE_ERROR", "No active audio track acquired");
        return;
      }

      addDebugLog("MICROPHONE_STARTED", `Track: ${track.label} (active: ${track.enabled})`);
      addDebugLog("AUDIO_STREAM_STARTED", `Sample rate: ${track.getSettings().sampleRate || "default"}`);

      // Set up AudioContext for real-time visualizer
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVisualizer = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(updateVisualizer);
        };
        updateVisualizer();
      } catch (err) {
        addDebugLog("AUDIO_VISUALIZER_WARN", String(err));
      }

      // Initialize MediaRecorder for chunking & streaming
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/wav";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          addDebugLog("AUDIO_CHUNK_CAPTURED", `${e.data.size} bytes captured`);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        setInfoMessage("Recording microphone audio... Speak now!");
        addDebugLog("MEDIA_RECORDER_STARTED", `Mime: ${mimeType}`);
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        setInfoMessage("Processing microphone speech...");
        addDebugLog("MEDIA_RECORDER_STOPPED", `Total chunks: ${audioChunksRef.current.length}`);

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 500) {
          addDebugLog("STT_ERROR", "Audio snippet too short or silent.");
          setInfoMessage("I couldn't hear you clearly. Please try speaking again.");
          return;
        }

        // Convert blob to Base64 and send chunk to backend
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(",")[1];
          if (socket && activeCallId) {
            addDebugLog("AUDIO_CHUNK_SENT", `Sending ${blob.size} bytes (${mimeType}) to backend...`);
            addDebugLog("STT_STARTED", `Call #${activeCallId}`);

            socket.emit("voice_session:audio_chunk", {
              callId: activeCallId,
              chunk: base64data,
              mimeType: mimeType,
              isFinal: true,
            });
          }
        };
      };

      recorder.start(500); // Collect slice every 500ms
    } catch (err: any) {
      addDebugLog("MICROPHONE_ERROR", err.message || "Failed to start microphone");
      setInfoMessage(`Microphone error: ${err.message}. Please check browser permissions.`);
    }
  };

  const stopMicrophoneAudio = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  // Browser STT fallback setup
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = speechLang;

      recognition.onstart = () => {
        setIsBrowserSttActive(true);
        addDebugLog("STT_STARTED", `Browser SpeechRecognition active (${speechLang})`);
      };

      recognition.onresult = (event: any) => {
        let interimText = "";
        let finalText = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }

        if (interimText) {
          addDebugLog("STT_PARTIAL_TRANSCRIPT", interimText);
        }

        if (finalText.trim()) {
          addDebugLog("STT_FINAL_TRANSCRIPT", finalText.trim());
          sendTextUtterance(finalText.trim());
        }
      };

      recognition.onerror = (err: any) => {
        addDebugLog("STT_ERROR", err.error);
        setIsBrowserSttActive(false);
      };

      recognition.onend = () => {
        setIsBrowserSttActive(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      addDebugLog("STT_ERROR", String(e));
    }
  }, [speechLang]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const onStarted = (data: {
      callId: number;
      agentReply: string;
      intent: string;
      segments?: SpeechSegment[];
      audioBase64?: string;
    }) => {
      setActiveCallId(data.callId);
      setCallState("ACTIVE");
      setLastIntent(data.intent || "UNCLEAR");
      setInfoMessage("Call connected! Agent is speaking...");

      addDebugLog("CALL_STARTED", `Call ID #${data.callId}`);

      setTranscript([
        {
          id: String(Date.now()),
          speaker: "AGENT",
          text: data.agentReply,
          segments: data.segments,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
      ]);

      playAgentResponseSpeech(data.agentReply, data.audioBase64, data.segments);
    };

    const onSttResult = (data: { callId: number; text: string }) => {
      addDebugLog("AUDIO_CHUNK_RECEIVED", `Transcribed: "${data.text}"`);
    };

    const onSttSilence = (data: { message?: string; unconfigured?: boolean }) => {
      if (Date.now() - lastTranscriptTimeRef.current < 5000) {
        // Transcript was already processed; do not overwrite info message with trailing silence
        return;
      }
      addDebugLog("STT_INFO", data.message || "No speech detected");
      if (!data.unconfigured) {
        setInfoMessage(data.message || "I couldn't hear you clearly. Please try speaking again.");
      }
    };

    const onAgentResponse = (data: {
      callId: number;
      customerText?: string;
      agentReply: string;
      intent: string;
      confidence: number;
      needsFollowUp: boolean;
      language?: string;
      segments?: SpeechSegment[];
      audioBase64?: string;
    }) => {
      setLastIntent(data.intent);
      setLastConfidence(data.confidence || 0);
      if (data.language) setDetectedLang(data.language);

      setTranscript((prev) => {
        const updated = [...prev];
        if (data.customerText) {
          const lastMsg = updated[updated.length - 1];
          if (!lastMsg || lastMsg.speaker !== "CUSTOMER" || lastMsg.text !== data.customerText) {
            updated.push({
              id: String(Date.now() + Math.random()),
              speaker: "CUSTOMER",
              text: data.customerText,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
            });
          }
        }
        updated.push({
          id: String(Date.now() + Math.random()),
          speaker: "AGENT",
          text: data.agentReply,
          segments: data.segments,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        });
        return updated;
      });

      playAgentResponseSpeech(data.agentReply, data.audioBase64, data.segments);
    };

    const onCompleted = (data: {
      callId: number;
      intent?: string;
      agentReply?: string;
      confidence?: number;
    }) => {
      setCallState("COMPLETED");
      if (data.intent) setLastIntent(data.intent);
      if (data.confidence) setLastConfidence(data.confidence);
      stopMicrophoneAudio();
      setInfoMessage(
        data.intent === "CONFIRMED"
          ? "Call ended: Order successfully confirmed!"
          : data.intent === "CANCELLED"
            ? "Call ended: Order was cancelled by customer."
            : "Call completed.",
      );
    };

    const onAborted = () => {
      setCallState("ABORTED");
      stopMicrophoneAudio();
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setInfoMessage("Call terminated.");
    };

    const onError = (data: { message?: string }) => {
      addDebugLog("STT_ERROR", data.message || "Voice session error");
      setInfoMessage(`Error: ${data.message || "Voice session error"}`);
      setCallState("IDLE");
      stopMicrophoneAudio();
    };

    socket.on("voice_session:started", onStarted);
    socket.on("voice_session:stt_result", onSttResult);
    socket.on("voice_session:stt_silence", onSttSilence);
    socket.on("voice_session:agent_response", onAgentResponse);
    socket.on("voice_session:completed", onCompleted);
    socket.on("voice_session:aborted", onAborted);
    socket.on("voice_session:error", onError);

    return () => {
      socket.off("voice_session:started", onStarted);
      socket.off("voice_session:stt_result", onSttResult);
      socket.off("voice_session:stt_silence", onSttSilence);
      socket.off("voice_session:agent_response", onAgentResponse);
      socket.off("voice_session:completed", onCompleted);
      socket.off("voice_session:aborted", onAborted);
      socket.off("voice_session:error", onError);
    };
  }, [socket]);

  // Actions
  const handleStartCall = () => {
    if (!socket || !connected) {
      setInfoMessage("Realtime server disconnected. Please check backend.");
      return;
    }
    if (!selectedOrderId) {
      setInfoMessage("Please select a pending order to call.");
      return;
    }

    setTranscript([]);
    setCallDuration(0);
    setCallState("CONNECTING");
    setInfoMessage("Dialing customer simulation...");
    setLastIntent("UNCLEAR");
    setLastConfidence(0);

    socket.emit("voice_session:start", { orderId: selectedOrderId });
  };

  const handleEndCall = () => {
    if (!socket || !activeCallId) return;
    socket.emit("voice_session:abort", { callId: activeCallId });
    stopMicrophoneAudio();
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopMicrophoneAudio();
    } else {
      startMicrophoneAudio();
    }
  };

  const sendTextUtterance = (text: string) => {
    if (!socket || !activeCallId || !text.trim()) return;

    lastTranscriptTimeRef.current = Date.now();

    setTranscript((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        speaker: "CUSTOMER",
        text: text.trim(),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      },
    ]);

    addDebugLog("TRANSCRIPT_SENT", `Customer: "${text.trim()}"`);
    socket.emit("voice_session:transcript", {
      callId: activeCallId,
      text: text.trim(),
    });
    setTextInput("");
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      sendTextUtterance(textInput.trim());
    }
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>AI Voice Confirmation Agent</h1>
          <p className={styles.heroSubtitle}>
            Interactive Multilingual Prototype — Supports French, English, Tunisian Arabic (Derja), and Code-Switching.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            type="button"
            className={ui.btnSecondary}
            onClick={() => setShowDebug((v) => !v)}
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
          >
            {showDebug ? "Hide Debug Logs" : "Show Debug Logs"}
          </button>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.8rem",
              color: connected ? "#10b981" : "#ef4444",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: connected ? "#10b981" : "#ef4444",
              }}
            />
            {connected ? "Gateway Online" : "Connecting..."}
          </span>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Left Column: Order Selector & Settings */}
        <div className={`${ui.card} ${styles.sidebarCard}`}>
          <div className={styles.cardTitle}>
            <span>Test Orders</span>
            <span className={styles.badgePending}>
              {orders.filter((o) => o.status === "pending").length} Pending
            </span>
          </div>

          <p style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
            Select an order to simulate an outbound phone call:
          </p>

          <div className={styles.orderList}>
            {orders.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                No pending orders found. Create an order first.
              </p>
            ) : (
              orders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`${styles.orderItem} ${
                    selectedOrderId === o.id ? styles.orderItemSelected : ""
                  }`}
                  onClick={() => {
                    if (callState === "ACTIVE") return;
                    setSelectedOrderId(o.id);
                  }}
                  disabled={callState === "ACTIVE"}
                >
                  <div className={styles.orderItemTop}>
                    <span>#{o.id} — {o.customer}</span>
                    <span>{formatTND(o.total)}</span>
                  </div>
                  <div className={styles.orderItemSub}>
                    <span>{o.phone}</span>
                    <span style={{ textTransform: "capitalize" }}>{o.status}</span>
                  </div>
                  {o.items && o.items.length > 0 && (
                    <div className={styles.orderProducts}>
                      {o.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          <div className={styles.configSection}>
            <span className={styles.configLabel}>Browser STT Language</span>
            <select
              className={styles.select}
              value={speechLang}
              onChange={(e) => setSpeechLang(e.target.value)}
              disabled={callState === "ACTIVE"}
            >
              <option value="fr-FR">Français (France / Tunisie)</option>
              <option value="ar-TN">العربية التونسية (Tunisian Arabic)</option>
              <option value="ar-XA">العربية العامة (Standard Arabic)</option>
              <option value="en-US">English (US)</option>
            </select>
          </div>

          <div className={styles.configSection}>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={ttsEnabled}
                onChange={(e) => setTtsEnabled(e.target.checked)}
              />
              <span>Enable Agent Voice Speech (Speakers)</span>
            </label>
          </div>
        </div>

        {/* Right Column: Interactive Phone Call Console */}
        <div className={`${ui.card} ${styles.consoleCard}`}>
          <div className={styles.callHeader}>
            <div className={styles.callStatusWrap}>
              <div
                className={`${styles.statusIndicator} ${
                  callState === "ACTIVE"
                    ? styles.statusActive
                    : callState === "CONNECTING"
                      ? styles.statusConnecting
                      : ""
                }`}
              />
              <div>
                <div className={styles.statusText}>
                  {callState === "IDLE" && "Ready to Call"}
                  {callState === "CONNECTING" && "Dialing Customer..."}
                  {callState === "ACTIVE" && `In Call with ${selectedOrder?.customer || "Customer"}`}
                  {callState === "COMPLETED" && "Call Finished"}
                  {callState === "ABORTED" && "Call Aborted"}
                </div>
                {selectedOrder && (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Order #{selectedOrder.id} ({selectedOrder.phone})
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {callState === "ACTIVE" && (
                <span className={styles.timer}>{formatTimer(callDuration)}</span>
              )}

              {callState === "IDLE" || callState === "COMPLETED" || callState === "ABORTED" ? (
                <button
                  type="button"
                  className={styles.startCallBtn}
                  onClick={handleStartCall}
                  disabled={!selectedOrderId || !connected}
                >
                  <Icon name="phoneCall" size={18} />
                  <span>Start AI Call</span>
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.hangupBtn}
                  onClick={handleEndCall}
                >
                  <Icon name="phoneOff" size={18} />
                  <span>Hang Up</span>
                </button>
              )}
            </div>
          </div>

          {/* Realtime Intent & Intelligence Status */}
          <div className={styles.intentBanner}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                DETECTED INTENT:
              </span>
              <span
                className={`${styles.intentBadge} ${
                  lastIntent === "CONFIRMED"
                    ? styles.intentConfirmed
                    : lastIntent === "CANCELLED"
                      ? styles.intentCancelled
                      : styles.intentUnclear
                }`}
              >
                {lastIntent}
              </span>
              {lastConfidence > 0 && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  ({Math.round(lastConfidence * 100)}% conf.)
                </span>
              )}
            </div>

            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Language: <strong>{detectedLang}</strong>
            </div>
          </div>

          {infoMessage && (
            <div
              style={{
                fontSize: "0.8rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                background: "var(--surface-hover, #f1f5f9)",
                color: "var(--text, #334155)",
              }}
            >
              {infoMessage}
            </div>
          )}

          {/* Live Transcript Stream */}
          <div className={styles.transcriptArea}>
            {transcript.length === 0 ? (
              <div className={styles.emptyTranscript}>
                <Icon name="headset" size={32} />
                <p>
                  Press <strong>&quot;Start AI Call&quot;</strong> to begin conversation.
                  <br />
                  The AI voice agent will greet the customer and confirm the order details.
                </p>
              </div>
            ) : (
              transcript.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.bubble} ${
                    msg.speaker === "AGENT"
                      ? styles.bubbleAgent
                      : styles.bubbleCustomer
                  }`}
                >
                  <span className={styles.bubbleSpeaker}>
                    {msg.speaker === "AGENT" ? "🤖 Ordely AI Agent" : "👤 Customer (You)"}
                  </span>
                  <div>{msg.text}</div>

                  {msg.segments && msg.segments.length > 1 && (
                    <div style={{ marginTop: "0.25rem", display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                      {msg.segments.map((s, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: "0.65rem",
                            padding: "0.1rem 0.35rem",
                            borderRadius: "0.2rem",
                            background: "rgba(99, 102, 241, 0.1)",
                            color: "var(--primary, #6366f1)",
                            fontWeight: 600,
                          }}
                        >
                          [{s.language}] {s.text.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  <span
                    style={{
                      fontSize: "0.65rem",
                      opacity: 0.7,
                      alignSelf: msg.speaker === "CUSTOMER" ? "flex-end" : "flex-start",
                    }}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              ))
            )}
            <div ref={transcriptBottomRef} />
          </div>

          {/* User Controls: Real Mic (getUserMedia) & Text Fallback */}
          <div className={styles.controlArea}>
            <div className={styles.actionRow}>
              <button
                type="button"
                className={`${styles.micButton} ${
                  isRecording ? styles.micButtonListening : ""
                }`}
                onClick={toggleRecording}
                disabled={callState !== "ACTIVE"}
                title={
                  callState !== "ACTIVE"
                    ? "Start call first"
                    : isRecording
                      ? "Click to stop recording audio"
                      : "Click to record audio & stream to Whisper STT"
                }
              >
                {isRecording ? (
                  <>
                    <div className={styles.listeningWave}>
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <span>Recording... (Click when done)</span>
                  </>
                ) : (
                  <>
                    <Icon name="headset" size={18} />
                    <span>{callState === "ACTIVE" ? "Record Mic (Whisper STT)" : "Mic Ready"}</span>
                  </>
                )}
              </button>

              {audioLevel > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Input level:</span>
                  <div
                    style={{
                      width: 80,
                      height: 8,
                      borderRadius: 4,
                      background: "#e2e8f0",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${audioLevel}%`,
                        height: "100%",
                        background: audioLevel > 50 ? "#10b981" : "#6366f1",
                        transition: "width 0.1s ease",
                      }}
                    />
                  </div>
                </div>
              )}

              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Try: <em>&quot;Bonjour, نحب نأكد la commande&quot;</em> or <em>&quot;Ey mriguel&quot;</em>.
              </span>
            </div>

            {/* Manual text input fallback */}
            <form onSubmit={handleTextSubmit} className={styles.textInputRow}>
              <input
                type="text"
                placeholder={
                  callState === "ACTIVE"
                    ? "Type customer text (e.g. Bonjour, نحب نأكد...)"
                    : "Start call to send messages..."
                }
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                disabled={callState !== "ACTIVE"}
                className={styles.textInput}
              />
              <button
                type="submit"
                disabled={callState !== "ACTIVE" || !textInput.trim()}
                className={styles.sendBtn}
              >
                Send
              </button>
            </form>
          </div>

          {/* Development Debug Logs Panel */}
          {showDebug && debugLogs.length > 0 && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem",
                borderRadius: "0.375rem",
                background: "#0f172a",
                color: "#38bdf8",
                fontFamily: "monospace",
                fontSize: "0.75rem",
                maxHeight: "160px",
                overflowY: "auto",
                border: "1px solid #334155",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.4rem",
                  color: "#94a3b8",
                  fontWeight: "bold",
                }}
              >
                <span>VOICE PIPELINE DEBUG LOGS</span>
                <button
                  type="button"
                  onClick={() => setDebugLogs([])}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    fontSize: "0.7rem",
                  }}
                >
                  Clear
                </button>
              </div>
              {debugLogs.map((log, index) => (
                <div key={index} style={{ whiteSpace: "pre-wrap" }}>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
