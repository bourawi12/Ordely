const fs = require('node:fs');

/**
 * Client for sending lifecycle events, transcripts, and audio artifacts
 * from the Ringio voice agent runtime back to Ordely.
 */
class OrdelyCallbackClient {
  constructor({
    callbackUrl = process.env.ORDELY_CALLBACK_URL || 'http://127.0.0.1:3000',
    callbackSecret = process.env.ORDELY_CALLBACK_SECRET || 'dev-test-token',
    logger = console,
  } = {}) {
    this.callbackUrl = callbackUrl.replace(/\/$/, '');
    this.callbackSecret = callbackSecret;
    this.logger = logger;
  }

  get enabled() {
    return !!this.callbackUrl;
  }

  async sendEvent({ taskId, phase, providerCallId, message }) {
    if (!this.enabled || !taskId) return;
    try {
      const res = await fetch(`${this.callbackUrl}/internal/voice/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.callbackSecret}`,
        },
        body: JSON.stringify({
          taskId,
          phase,
          providerCallId,
          timestamp: new Date().toISOString(),
          message,
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Ordely callback event rejected: ${res.status}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send event to Ordely: ${err.message}`);
    }
  }

  async sendTranscript({ taskId, sequence, speaker, text, timestamp }) {
    if (!this.enabled || !taskId) return;
    try {
      // Map Ringio speaker 'mobile' to Ordely 'customer'
      const mappedSpeaker = speaker === 'mobile' ? 'customer' : speaker;
      const res = await fetch(`${this.callbackUrl}/internal/voice/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.callbackSecret}`,
        },
        body: JSON.stringify({
          taskId,
          sequence,
          speaker: mappedSpeaker,
          text,
          timestamp: timestamp || new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Ordely transcript callback rejected: ${res.status}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send transcript to Ordely: ${err.message}`);
    }
  }

  async sendResult({
    taskId,
    providerCallId,
    disposition = 'confirmed',
    durationSeconds,
    error,
  }) {
    if (!this.enabled || !taskId) return;
    try {
      const res = await fetch(`${this.callbackUrl}/internal/voice/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.callbackSecret}`,
        },
        body: JSON.stringify({
          taskId,
          providerCallId,
          disposition,
          durationSeconds,
          timestamp: new Date().toISOString(),
          error,
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Ordely result callback rejected: ${res.status}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send result to Ordely: ${err.message}`);
    }
  }

  async uploadRecording({ taskId, speaker, filePath, buffer, durationMs }) {
    if (!this.enabled || !taskId) return;
    try {
      const fileBytes = buffer || (filePath ? fs.readFileSync(filePath) : null);
      if (!fileBytes) return;

      const mappedSpeaker = speaker === 'mobile' ? 'customer' : speaker;
      const formData = new FormData();
      formData.append('taskId', taskId);
      formData.append('speaker', mappedSpeaker);
      if (durationMs) formData.append('durationMs', String(durationMs));

      const blob = new Blob([fileBytes], { type: 'audio/wav' });
      formData.append('file', blob, `${mappedSpeaker}.wav`);

      const res = await fetch(`${this.callbackUrl}/internal/voice/recordings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.callbackSecret}`,
        },
        body: formData,
      });

      if (!res.ok) {
        this.logger.warn(`Ordely recording upload rejected: ${res.status}`);
      } else {
        this.logger.info(`Uploaded ${mappedSpeaker}.wav to Ordely for task ${taskId}`);
      }
    } catch (err) {
      this.logger.error(`Failed to upload recording to Ordely: ${err.message}`);
    }
  }
}

module.exports = { OrdelyCallbackClient };
