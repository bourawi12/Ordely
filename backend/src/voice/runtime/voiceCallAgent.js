const { AudioMediaBridge } = require('./audioMediaBridge');

class VoiceCallAgent {
  constructor({
    serverUrl,
    destinationNumber,
    availabilityPolicy = 'reject',
    iceServers,
    ioClient,
    wrtc,
    geminiFactory,
    artifactStore,
    artifactClient,
    mediaBridgeFactory = (options) => new AudioMediaBridge(options),
    logger = console,
    onStatus = () => {},
    taskId = null,
    ordelyClient = null,
  }) {
    if (!serverUrl || !destinationNumber || !ioClient || !wrtc || !geminiFactory || !artifactStore || !artifactClient) {
      throw new Error('VoiceCallAgent requires server, destination, Socket.IO, WebRTC, Gemini, and storage dependencies.');
    }
    this.serverUrl = serverUrl;
    this.destinationNumber = destinationNumber;
    this.availabilityPolicy = availabilityPolicy;
    this.iceServers = iceServers || [];
    this.ioClient = ioClient;
    this.wrtc = wrtc;
    this.geminiFactory = geminiFactory;
    this.artifactStore = artifactStore;
    this.artifactClient = artifactClient;
    this.mediaBridgeFactory = mediaBridgeFactory;
    this.logger = logger;
    this.onStatus = (phase) => {
      onStatus(phase);
      if (this.ordelyClient && this.taskId) {
        this.ordelyClient.sendEvent({
          taskId: this.taskId,
          phase,
          providerCallId: this.callId,
        });
      }
    };
    this.taskId = taskId;
    this.ordelyClient = ordelyClient;
    this.transcriptSequence = 0;
    this.startTime = null;
    this.socket = null;
    this.peer = null;
    this.bridge = null;
    this.gemini = null;
    this.removeGeminiListener = null;
    this.callId = null;
    this.greetingComplete = false;
    this.greetingStarted = false;
    this.geminiPromise = null;
    this.closing = false;
    this.finished = false;
    this.phoneCandidates = [];
    this.connectedOnce = false;
    this.transcriptWrites = Promise.resolve();
    this.finishTask = null;
    this.finishPromise = new Promise((resolve) => { this.resolveFinish = resolve; });
  }

  start() {
    this.onStatus('connecting');
    this.socket = this.ioClient(this.serverUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    this.socket.on('connect', () => {
      this.connectedOnce = true;
      if (!this.callId) {
        this.onStatus('registering');
        this.socket.emit('participant:register', {
          role: 'agent',
          mediaSource: 'gemini-live',
        });
      } else {
        this.logger.info(`Signaling socket reconnected to call server; re-associating with call ${this.callId}.`);
        this.socket.emit('call:reconnect', {
          callId: this.callId,
          role: 'caller',
        });
      }
    });
    this.socket.on('participant:registered', () => {
      if (!this.callId) {
        this.onStatus('dialing');
        this.socket.emit('call:start', {
          number: this.destinationNumber,
          availabilityPolicy: this.availabilityPolicy,
        });
      }
    });
    this.socket.on('call:queued', ({ number }) => {
      this.onStatus('queued');
      this.logger.info(`Call to ${number} queued.`);
    });
    this.socket.on('call:outgoing', ({ callId, number }) => {
      this.callId = callId;
      this.onStatus('ringing');
      this.logger.info(`Ringing simulated number ${number}.`);
      this.prepareGemini().catch((error) => this.fail(error));
    });
    this.socket.on('call:accepted', () => {
      this.onStatus('connecting');
      this.beginMedia().catch((error) => this.fail(error));
    });
    this.socket.on('rtc:answer', (payload) => this.handleAnswer(payload).catch((error) => this.fail(error)));
    this.socket.on('rtc:ice', (payload) => this.handleIce(payload).catch((error) => this.fail(error)));
    this.socket.on('call:rejected', () => this.finish('Call rejected.', 'rejected'));
    this.socket.on('call:ended', ({ reason, disconnectedParticipantRole }) => this.finish(
      disconnectedParticipantRole
        ? `Call ended (${reason}; ${disconnectedParticipantRole} disconnected).`
        : `Call ended (${reason}).`,
    ));
    this.socket.on('call:error', ({ message }) => this.fail(new Error(message || 'Call server error.')));
    this.socket.on('connect_error', (error) => {
      if (!this.connectedOnce) {
        this.fail(error);
      } else {
        this.logger.warn(`Signaling socket connection error: ${error.message}`);
      }
    });
    this.socket.on('disconnect', (reason) => {
      if (this.closing || this.finished) return;
      this.logger.warn(`Signaling socket disconnected (${reason || 'unknown'}).`);
      if (reason === 'io server disconnect') {
        this.finish('Disconnected by the call server.');
      }
    });
    const onReconnectFailed = () => {
      if (!this.closing && !this.finished) {
        this.finish('Call server reconnection failed.');
      }
    };
    this.socket.on('reconnect_failed', onReconnectFailed);
    this.socket.io?.on?.('reconnect_failed', onReconnectFailed);
    return this.finishPromise;
  }

  async beginMedia() {
    if (this.peer || this.closing) return;
    this.peer = new this.wrtc.RTCPeerConnection({ iceServers: this.iceServers });
    this.bridge = this.mediaBridgeFactory({
      peerConnection: this.peer,
      wrtc: this.wrtc,
      callId: this.callId,
      artifactStore: this.artifactStore,
      onMobileAudio: (samples) => {
        if (this.greetingComplete && this.gemini && !this.closing) this.gemini.sendAudio(samples, 16000);
      },
      onError: (error) => this.logger.error('Media artifact write failed:', error.message),
      onAudioMetrics: (metrics) => this.logger.info('Audio bridge metrics:', JSON.stringify(metrics)),
    });
    this.peer.onicecandidate = ({ candidate }) => {
      if (candidate && this.callId && !this.closing) {
        this.socket.emit('rtc:ice', { callId: this.callId, candidate: candidate.toJSON?.() || candidate });
      }
    };
    this.peer.onconnectionstatechange = () => {
      if (this.peer?.connectionState === 'connected') {
        this.startTime = Date.now();
        this.socket.emit('call:active', { callId: this.callId });
        this.onStatus('starting_gemini');
        this.startGemini().catch((error) => this.fail(error));
      } else if (this.peer?.connectionState === 'failed') {
        this.fail(new Error('WebRTC connection failed.'));
      }
    };

    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    this.socket.emit('rtc:offer', { callId: this.callId, description: this.peer.localDescription });
  }

  async handleAnswer({ callId, description }) {
    if (!this.peer || this.closing || callId !== this.callId) return;
    await this.peer.setRemoteDescription(new this.wrtc.RTCSessionDescription(description));
    const candidates = this.phoneCandidates;
    this.phoneCandidates = [];
    for (const candidate of candidates) await this.peer.addIceCandidate(new this.wrtc.RTCIceCandidate(candidate));
  }

  async handleIce({ callId, candidate }) {
    if (!candidate || !this.peer || this.closing || callId !== this.callId) return;
    const parsed = new this.wrtc.RTCIceCandidate(candidate);
    if (this.peer.remoteDescription) await this.peer.addIceCandidate(parsed);
    else this.phoneCandidates.push(candidate);
  }

  async startGemini() {
    if (this.greetingStarted || this.closing) return;
    this.greetingStarted = true;
    const gemini = await this.prepareGemini();
    if (!gemini || this.closing) return;
    this.onStatus('greeting');
    this.logger.info('Playing the Tunisian Derja introduction before opening the mobile mic stream.');
    gemini.introduce();
  }

  prepareGemini() {
    if (this.gemini) return Promise.resolve(this.gemini);
    if (this.geminiPromise) return this.geminiPromise;
    if (this.closing) return Promise.resolve(null);
    this.geminiPromise = (async () => {
      const gemini = await this.geminiFactory();
      if (this.closing) {
        gemini.close();
        return null;
      }
      this.gemini = gemini;
      this.removeGeminiListener = gemini.onEvent((event) => {
        this.handleGeminiEvent(event).catch((error) => this.fail(error));
      });
      this.logger.info('Gemini Live ready; waiting for the media connection before greeting.');
      return gemini;
    })();
    return this.geminiPromise;
  }

  async handleGeminiEvent(event) {
    if (this.closing) return;
    if (event.type === 'output-audio') {
      const sampleRate = Number(/rate=(\d+)/.exec(event.mimeType || '')?.[1]) || 24000;
      this.bridge.enqueueGeminiAudio(event.audio, sampleRate);
    } else if (event.type === 'transcript') {
      this.transcriptWrites = this.transcriptWrites.then(() => this.artifactClient.appendTranscript(this.callId, event));
      if (this.ordelyClient && this.taskId && event.text) {
        this.transcriptSequence++;
        this.ordelyClient.sendTranscript({
          taskId: this.taskId,
          sequence: this.transcriptSequence,
          speaker: event.speaker || 'agent',
          text: event.text,
          timestamp: new Date().toISOString(),
        });
      }
      await this.transcriptWrites;
    } else if (event.type === 'interrupted') {
      this.bridge.stopOutput();
    } else if (event.type === 'turn-complete') {
      this.bridge.flushOutput();
      await this.bridge.waitForOutputDrain();
      if (!this.greetingComplete) {
        this.greetingComplete = true;
        this.onStatus('live');
        this.logger.info('Introduction played. Mobile speech forwarding to Gemini is enabled.');
      }
    } else if (event.type === 'session-expiring') {
      this.logger.warn(`Gemini Live session is expiring in ${event.timeLeft || 'an unknown interval'}.`);
    } else if (event.type === 'error' || event.type === 'closed') {
      this.fail(event.error || new Error('Gemini Live session closed.'));
    }
  }

  async fail(error) {
    if (this.closing || this.finished) return;
    this.logger.error(error.message);
    if (this.callId && this.socket?.connected) this.socket.emit('call:end', { callId: this.callId });
    if (this.callId) {
      fetch(`${this.serverUrl.replace(/\/$/, '')}/api/calls/${encodeURIComponent(this.callId)}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
    await this.finish(`Agent error: ${error.message}`, 'error');
  }

  finish(message, phase = 'ended') {
    if (this.finishTask) return this.finishTask;
    if (this.finished) return Promise.resolve();
    this.closing = true;
    this.finishPhase = phase;
    this.onStatus(phase === 'error' || phase === 'rejected' ? phase : 'ending');
    this.finishTask = this.cleanup(message);
    return this.finishTask;
  }

  async cleanup(message) {
    this.removeGeminiListener?.();
    this.gemini?.close();
    if (this.peer) this.peer.close();
    if (this.bridge) await this.bridge.close().catch((error) => this.logger.error(error.message));
    await this.transcriptWrites.catch((error) => this.logger.error('Transcript save failed:', error.message));
    if (this.callId) {
      const assets = await this.artifactStore.finalizeCall(this.callId).catch((error) => {
        this.logger.error('Audio finalization failed:', error.message);
        return [];
      });
      if (assets.length) {
        await this.artifactClient.saveAudioAssets(this.callId, assets).catch((error) => {
          this.logger.error('Audio metadata save failed:', error.message);
        });
        if (this.ordelyClient && this.taskId) {
          for (const asset of assets) {
            await this.ordelyClient.uploadRecording({
              taskId: this.taskId,
              speaker: asset.speaker,
              filePath: asset.filePath,
              durationMs: asset.durationMs,
            }).catch((err) => this.logger.error('Ordely recording upload error:', err.message));
          }
        }
      }
    }
    if (this.ordelyClient && this.taskId) {
      const disposition =
        this.finishPhase === 'rejected'
          ? 'no_answer'
          : this.finishPhase === 'error'
            ? 'error'
            : 'needs_human';
      const durationSeconds = this.startTime
        ? Math.round((Date.now() - this.startTime) / 1000)
        : 0;
      await this.ordelyClient.sendResult({
        taskId: this.taskId,
        providerCallId: this.callId,
        disposition,
        durationSeconds,
      }).catch((err) => this.logger.error('Ordely result callback error:', err.message));
    }
    this.finished = true;
    this.onStatus(this.finishPhase || 'ended');
    this.logger.info(message);
    this.socket?.disconnect();
    this.resolveFinish({ callId: this.callId, message });
  }

  stop() {
    if (this.callId && this.socket?.connected) this.socket.emit('call:end', { callId: this.callId });
    if (this.callId) {
      fetch(`${this.serverUrl.replace(/\/$/, '')}/api/calls/${encodeURIComponent(this.callId)}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
    return this.finish('Agent stopped.', 'ended');
  }
}

module.exports = { VoiceCallAgent };