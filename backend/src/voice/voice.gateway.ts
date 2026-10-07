import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { VoiceSessionService } from './voice-session.service';
import { SttService } from './stt.service';

/**
 * Voice WebSocket Gateway — reuses the same Socket.IO server as RealtimeGateway.
 * Handles call lifecycle, raw audio chunks (MediaRecorder/WebRTC/VAD), STT events, and TTS output.
 *
 * Event contract:
 *   C→S  voice_session:start        { orderId }
 *   S→C  voice_session:started      { callId, agentReply, intent, segments, audioBase64 }
 *   C→S  voice_session:audio_chunk  { callId, chunk, mimeType?, isFinal? }
 *   S→C  voice_session:stt_result   { callId, text, isFinal }
 *   S→C  voice_session:stt_silence  { callId, message }
 *   C→S  voice_session:transcript   { callId, text }  (customer text fallback or browser STT)
 *   S→C  voice_session:agent_response { callId, customerText?, agentReply, intent, confidence, needsFollowUp, language, segments, audioBase64 }
 *   C→S  voice_session:complete     { callId }
 *   S→C  voice_session:completed    { callId, intent, agentReply, confidence }
 *   C→S  voice_session:abort        { callId }
 *   S→C  voice_session:aborted      { callId }
 *   S→C  voice_session:error        { callId?, message }
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class VoiceGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private readonly audioBuffers = new Map<number, Buffer[]>();

  constructor(
    private readonly voiceSession: VoiceSessionService,
    private readonly sttService: SttService,
  ) {}

  afterInit(_server: Server) {
    this.logger.log('VoiceGateway initialized');
  }

  // -----------------------------------------------------------------------
  // Start a new voice session
  // -----------------------------------------------------------------------
  @SubscribeMessage('voice_session:start')
  async handleStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: number },
  ) {
    const user = client.data.user as {
      sub: number;
      boutiqueId: number;
    } | undefined;

    if (!user) {
      client.emit('voice_session:error', { message: 'Not authenticated' });
      return;
    }

    try {
      const { callId, greeting } = await this.voiceSession.startSession(
        user.boutiqueId,
        user.sub,
        data.orderId,
      );

      this.audioBuffers.set(callId, []);

      client.emit('voice_session:started', {
        callId,
        agentReply: greeting.agentReply,
        intent: greeting.intent,
        segments: greeting.segments,
        audioBase64: greeting.audioBase64,
      });
    } catch (err) {
      client.emit('voice_session:error', {
        message: (err as Error).message ?? 'Failed to start session',
      });
    }
  }

  // -----------------------------------------------------------------------
  // Process raw audio chunk streamed from client microphone (MediaRecorder)
  // -----------------------------------------------------------------------
  @SubscribeMessage('voice_session:audio_chunk')
  async handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      callId: number;
      chunk: string | ArrayBuffer | Buffer;
      mimeType?: string;
      isFinal?: boolean;
    },
  ) {
    const user = client.data.user as { sub: number; boutiqueId: number } | undefined;
    if (!user) {
      client.emit('voice_session:error', { message: 'Not authenticated' });
      return;
    }

    let buf: Buffer;
    if (typeof data.chunk === 'string') {
      buf = Buffer.from(data.chunk, 'base64');
    } else if (Buffer.isBuffer(data.chunk)) {
      buf = data.chunk;
    } else {
      buf = Buffer.from(data.chunk);
    }

    this.logger.log(
      `[VOICE_DEBUG] AUDIO_CHUNK_RECEIVED: ${buf.length} bytes for call #${data.callId} (isFinal: ${Boolean(data.isFinal)})`,
    );

    const existing = this.audioBuffers.get(data.callId) || [];
    existing.push(buf);
    this.audioBuffers.set(data.callId, existing);

    // If final chunk of utterance, trigger STT transcription & processing
    if (data.isFinal) {
      const completeAudio = Buffer.concat(existing);
      this.audioBuffers.set(data.callId, []); // Reset for next utterance

      try {
        const sttResult = await this.sttService.transcribe(
          completeAudio,
          data.mimeType || 'audio/webm',
        );

        if (!sttResult.text || !sttResult.text.trim()) {
          this.logger.warn(`[VOICE_DEBUG] STT_NO_SPEECH for call #${data.callId}`);
          if (!this.sttService.isConfigured()) {
            client.emit('voice_session:stt_silence', {
              callId: data.callId,
              message: 'Server Whisper STT requires OPENAI_API_KEY. Real-time browser STT / text input active.',
              unconfigured: true,
            });
          } else {
            client.emit('voice_session:stt_silence', {
              callId: data.callId,
              message: 'No speech detected. Please speak into your microphone.',
            });
          }
          return;
        }

        // Notify client what was transcribed
        client.emit('voice_session:stt_result', {
          callId: data.callId,
          text: sttResult.text,
          isFinal: true,
        });

        // Pass to conversational AI
        const analysis = await this.voiceSession.processUtterance(
          data.callId,
          user.boutiqueId,
          sttResult.text,
        );

        client.emit('voice_session:agent_response', {
          callId: data.callId,
          customerText: sttResult.text,
          agentReply: analysis.agentReply,
          intent: analysis.intent,
          confidence: analysis.confidence,
          needsFollowUp: analysis.needsFollowUp,
          language: analysis.language,
          segments: analysis.segments,
          audioBase64: analysis.audioBase64,
        });

        // Complete if decision reached
        if (analysis.intent !== 'UNCLEAR') {
          await this.completeSessionInternal(client, data.callId, user.boutiqueId);
        }
      } catch (err) {
        client.emit('voice_session:error', {
          callId: data.callId,
          message: (err as Error).message ?? 'STT processing failed',
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Process a customer utterance via text (manual or browser STT)
  // -----------------------------------------------------------------------
  @SubscribeMessage('voice_session:transcript')
  async handleTranscript(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: number; text: string },
  ) {
    const user = client.data.user as { sub: number; boutiqueId: number } | undefined;
    if (!user) {
      client.emit('voice_session:error', { message: 'Not authenticated' });
      return;
    }

    try {
      this.logger.log(`[VOICE_DEBUG] TRANSCRIPT_RECEIVED: "${data.text}" for call #${data.callId}`);
      const analysis = await this.voiceSession.processUtterance(
        data.callId,
        user.boutiqueId,
        data.text,
      );

      client.emit('voice_session:agent_response', {
        callId: data.callId,
        customerText: data.text,
        agentReply: analysis.agentReply,
        intent: analysis.intent,
        confidence: analysis.confidence,
        needsFollowUp: analysis.needsFollowUp,
        language: analysis.language,
        segments: analysis.segments,
        audioBase64: analysis.audioBase64,
      });

      // If the LLM reached a final decision, automatically complete the session
      if (analysis.intent !== 'UNCLEAR') {
        await this.completeSessionInternal(client, data.callId, user.boutiqueId);
      }
    } catch (err) {
      client.emit('voice_session:error', {
        callId: data.callId,
        message: (err as Error).message ?? 'Processing failed',
      });
    }
  }

  // -----------------------------------------------------------------------
  // Manual session completion
  // -----------------------------------------------------------------------
  @SubscribeMessage('voice_session:complete')
  async handleComplete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: number },
  ) {
    const user = client.data.user as { sub: number; boutiqueId: number } | undefined;
    if (!user) return;
    this.audioBuffers.delete(data.callId);
    await this.completeSessionInternal(client, data.callId, user.boutiqueId);
  }

  // -----------------------------------------------------------------------
  // Abort
  // -----------------------------------------------------------------------
  @SubscribeMessage('voice_session:abort')
  async handleAbort(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: number },
  ) {
    const user = client.data.user as { sub: number; boutiqueId: number } | undefined;
    if (!user) return;

    this.audioBuffers.delete(data.callId);

    try {
      await this.voiceSession.abortSession(data.callId, user.boutiqueId);
      client.emit('voice_session:aborted', { callId: data.callId });
    } catch (err) {
      client.emit('voice_session:error', {
        callId: data.callId,
        message: (err as Error).message,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Internal helper
  // -----------------------------------------------------------------------
  private async completeSessionInternal(
    client: Socket,
    callId: number,
    boutiqueId: number,
  ) {
    try {
      this.audioBuffers.delete(callId);
      const { finalAnalysis } = await this.voiceSession.completeSession(
        callId,
        boutiqueId,
      );
      client.emit('voice_session:completed', {
        callId,
        intent: finalAnalysis?.intent,
        agentReply: finalAnalysis?.agentReply,
        confidence: finalAnalysis?.confidence,
      });
    } catch (err) {
      client.emit('voice_session:error', {
        callId,
        message: (err as Error).message,
      });
    }
  }
}
