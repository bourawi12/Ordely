const { mixToMono, resamplePcm16 } = require('./audioPcm');

class AudioMediaBridge {
  constructor({ peerConnection, wrtc, callId, artifactStore, onMobileAudio, onError, onAudioMetrics, outputSampleRate = 48000, outputBufferMs = 150, metricsIntervalMs = 5000, now = () => performance.now(), scheduleTimer = setTimeout, cancelTimer = clearTimeout }) {
    if (!peerConnection || !wrtc?.nonstandard?.RTCAudioSource || !wrtc?.nonstandard?.RTCAudioSink) {
      throw new TypeError('A WebRTC peer and audio source/sink implementation are required.');
    }
    this.peerConnection = peerConnection;
    this.callId = callId;
    this.artifactStore = artifactStore;
    this.onMobileAudio = onMobileAudio;
    this.onError = onError;
    this.onAudioMetrics = onAudioMetrics;
    this.outputSampleRate = outputSampleRate;
    this.outputFrameSize = Math.round(outputSampleRate / 100);
    this.outputPrebufferFrames = Math.ceil(outputBufferMs / 10);
    this.metricsIntervalMs = metricsIntervalMs;
    this.now = now;
    this.scheduleTimer = scheduleTimer;
    this.cancelTimer = cancelTimer;
    this.source = new wrtc.nonstandard.RTCAudioSource();
    this.track = this.source.createTrack();
    this.peerConnection.addTrack(this.track);
    this.sinks = new Set();
    this.outputQueue = [];
    this.pendingOutputSamples = new Int16Array(0);
    this.outputTimer = null;
    this.nextOutputAt = null;
    this.lastMetricsAt = this.now();
    this.audioMetrics = createAudioMetrics();
    this.consecutiveSilenceFrames = 0;
    this.outputStarted = false;
    this.outputTurnOpen = false;
    this.drainWaiters = [];
    this.mobileWriteChain = Promise.resolve();
    this.agentWriteChain = Promise.resolve();
    this.closed = false;

    this.peerConnection.ontrack = ({ track }) => this.attachRemoteTrack(track, wrtc.nonstandard.RTCAudioSink);
  }

  attachRemoteTrack(track, AudioSink) {
    if (this.closed || track.kind !== 'audio') return;
    const sink = new AudioSink(track);
    this.sinks.add(sink);
    sink.ondata = ({ samples, sampleRate, channelCount = 1 }) => {
      if (this.closed || !samples?.length) return;
      const mono = mixToMono(samples, channelCount);
      const artifactPcm = resamplePcm16(mono, sampleRate, this.outputSampleRate);
      if (this.artifactStore) {
        this.mobileWriteChain = this.mobileWriteChain.then(() => this.artifactStore.appendPcm({
          callId: this.callId,
          speaker: 'mobile',
          samples: artifactPcm,
          sampleRate: this.outputSampleRate,
        })).catch((error) => this.onError?.(error));
      }
      const geminiPcm = resamplePcm16(mono, sampleRate, 16000);
      this.onMobileAudio?.(geminiPcm);
    };
  }

  enqueueGeminiAudio(audioBuffer, sampleRate = 24000) {
    if (this.closed || !audioBuffer?.length) return;
    this.outputTurnOpen = true;
    this.consecutiveSilenceFrames = 0;
    const sourcePcm = Buffer.isBuffer(audioBuffer)
      ? bufferToSamples(audioBuffer)
      : new Int16Array(audioBuffer);
    this.audioMetrics.geminiChunks += 1;
    this.audioMetrics.geminiAudioMs += sourcePcm.length / sampleRate * 1000;
    const artifactPcm = resamplePcm16(sourcePcm, sampleRate, this.outputSampleRate);
    if (this.artifactStore) {
      this.agentWriteChain = this.agentWriteChain.then(() => this.artifactStore.appendPcm({
        callId: this.callId,
        speaker: 'agent',
        samples: artifactPcm,
        sampleRate: this.outputSampleRate,
      })).catch((error) => this.onError?.(error));
    }
    const webRtcPcm = resamplePcm16(sourcePcm, sampleRate, this.outputSampleRate);
    const samples = new Int16Array(this.pendingOutputSamples.length + webRtcPcm.length);
    samples.set(this.pendingOutputSamples);
    samples.set(webRtcPcm, this.pendingOutputSamples.length);
    let offset = 0;
    while (offset + this.outputFrameSize <= samples.length) {
      this.outputQueue.push(createAudioFrame(samples.subarray(offset, offset + this.outputFrameSize), this.outputSampleRate));
      offset += this.outputFrameSize;
    }
    this.pendingOutputSamples = samples.slice(offset);
    this.audioMetrics.maxQueueMs = Math.max(this.audioMetrics.maxQueueMs, this.getQueuedAudioMs());
    this.pumpOutput();
    this.reportAudioMetrics();
  }

  flushOutput() {
    if (this.closed) return;
    if (this.pendingOutputSamples.length) {
      const samples = new Int16Array(this.outputFrameSize);
      samples.set(this.pendingOutputSamples);
      this.outputQueue.push(createAudioFrame(samples, this.outputSampleRate));
      this.pendingOutputSamples = new Int16Array(0);
    }
    this.outputTurnOpen = false;
    this.pumpOutput(true);
  }

  pumpOutput(force = false) {
    if (this.closed || this.outputTimer) return;
    if (!this.outputStarted && !force && this.outputQueue.length < this.outputPrebufferFrames) {
      this.resolveDrainedIfReady();
      return;
    }
    if (!this.outputQueue.length) {
      if (this.outputStarted && this.outputTurnOpen && this.consecutiveSilenceFrames < 50) {
        this.consecutiveSilenceFrames += 1;
        const frameStart = this.now();
        if (this.nextOutputAt === null || frameStart - this.nextOutputAt > 40) {
          this.nextOutputAt = frameStart;
        }
        const silenceFrame = createAudioFrame(new Int16Array(this.outputFrameSize), this.outputSampleRate);
        this.source.onData(silenceFrame);
        this.audioMetrics.silenceFrames += 1;
        this.nextOutputAt += 10;
        const delay = Math.max(0, this.nextOutputAt - this.now());
        this.outputTimer = this.scheduleTimer(() => {
          this.outputTimer = null;
          this.pumpOutput();
        }, delay);
        return;
      }
      this.nextOutputAt = null;
      if (!this.outputTurnOpen) {
        this.outputStarted = false;
        this.resolveDrainedIfReady();
      }
      return;
    }
    this.consecutiveSilenceFrames = 0;
    this.outputStarted = true;
    const frame = this.outputQueue.shift();
    const frameStart = this.now();
    if (this.nextOutputAt === null || frameStart - this.nextOutputAt > 40) {
      this.nextOutputAt = frameStart;
    }
    const latenessMs = Math.max(0, frameStart - this.nextOutputAt);
    if (latenessMs > 2) {
      this.audioMetrics.lateFrames += 1;
      this.audioMetrics.totalLatenessMs += latenessMs;
      this.audioMetrics.maxLatenessMs = Math.max(this.audioMetrics.maxLatenessMs, latenessMs);
    }
    this.source.onData(frame);
    this.audioMetrics.outputFrames += 1;
    this.nextOutputAt += 10;
    const delay = Math.max(0, this.nextOutputAt - this.now());
    this.outputTimer = this.scheduleTimer(() => {
      this.outputTimer = null;
      this.pumpOutput();
    }, delay);
    this.reportAudioMetrics();
  }

  getQueuedAudioMs() {
    return (this.outputQueue.length * this.outputFrameSize + this.pendingOutputSamples.length)
      / this.outputSampleRate * 1000;
  }

  reportAudioMetrics(force = false) {
    const now = this.now();
    if (!force && now - this.lastMetricsAt < this.metricsIntervalMs) return;
    if (!this.audioMetrics.geminiChunks && !this.audioMetrics.outputFrames && !this.audioMetrics.silenceFrames) {
      this.lastMetricsAt = now;
      return;
    }
    const metrics = { ...this.audioMetrics, windowMs: Math.round(now - this.lastMetricsAt) };
    this.audioMetrics = createAudioMetrics();
    this.lastMetricsAt = now;
    try {
      this.onAudioMetrics?.(metrics);
    } catch (error) {
      this.onError?.(error);
    }
  }

  waitForOutputDrain() {
    if (!this.outputTimer && this.outputQueue.length === 0 && this.pendingOutputSamples.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.drainWaiters.push(resolve));
  }

  stopOutput() {
    if (this.outputTimer) this.cancelTimer(this.outputTimer);
    this.outputTimer = null;
    this.nextOutputAt = null;
    this.outputQueue = [];
    this.pendingOutputSamples = new Int16Array(0);
    this.outputStarted = false;
    this.outputTurnOpen = false;
    this.consecutiveSilenceFrames = 0;
    this.resolveDrainedIfReady();
  }

  resolveDrainedIfReady() {
    if (this.outputTimer || this.outputQueue.length || this.pendingOutputSamples.length) return;
    const waiters = this.drainWaiters;
    this.drainWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  async close() {
    if (this.closed) return;
    this.reportAudioMetrics(true);
    this.closed = true;
    this.stopOutput();
    for (const sink of this.sinks) sink.stop();
    this.sinks.clear();
    this.track.stop();
    await Promise.all([this.mobileWriteChain, this.agentWriteChain]);
  }
}

function createAudioFrame(samples, sampleRate) {
  const frameSamples = new Int16Array(samples);
  return { samples: frameSamples, sampleRate, channelCount: 1, bitsPerSample: 16, numberOfFrames: frameSamples.length };
}

function createAudioMetrics() {
  return {
    geminiChunks: 0,
    geminiAudioMs: 0,
    outputFrames: 0,
    silenceFrames: 0,
    lateFrames: 0,
    totalLatenessMs: 0,
    maxLatenessMs: 0,
    maxQueueMs: 0,
  };
}

function bufferToSamples(buffer) {
  if (buffer.length % 2 !== 0) throw new RangeError('Gemini PCM16 byte length must be even.');
  const samples = new Int16Array(buffer.length / 2);
  for (let index = 0; index < samples.length; index += 1) samples[index] = buffer.readInt16LE(index * 2);
  return samples;
}

module.exports = { AudioMediaBridge, bufferToSamples };