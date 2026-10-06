const fs = require('node:fs/promises');
const path = require('node:path');
const { int16ToBuffer } = require('./audioPcm');

const SPEAKERS = new Set(['agent', 'mobile']);

function createWavHeader({ dataBytes, sampleRate, channelCount }) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channelCount * 2;
  const blockAlign = channelCount * 2;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channelCount, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataBytes, 40);
  return header;
}

function validateIdentity(callId, speaker) {
  if (!/^[0-9a-f-]{16,64}$/i.test(callId)) throw new TypeError('Invalid call ID.');
  if (!SPEAKERS.has(speaker)) throw new TypeError('Speaker must be agent or mobile.');
}

class AudioArtifactStore {
  constructor({ rootDir = process.env.VOICE_RECORDINGS_DIR || path.join(__dirname, 'recordings') } = {}) {
    this.rootDir = path.resolve(rootDir);
    this.writers = new Map();
  }

  async appendPcm({ callId, speaker, samples, sampleRate, channelCount = 1 }) {
    validateIdentity(callId, speaker);
    if (!(samples instanceof Int16Array)) throw new TypeError('PCM samples must be Int16Array.');
    if (!Number.isInteger(sampleRate) || sampleRate < 8000) throw new RangeError('Invalid PCM sample rate.');
    if (!Number.isInteger(channelCount) || channelCount < 1 || channelCount > 2) throw new RangeError('Invalid PCM channel count.');

    const key = `${callId}:${speaker}`;
    let writer = this.writers.get(key);
    if (!writer) {
      const directory = path.join(this.rootDir, callId);
      await fs.mkdir(directory, { recursive: true });
      const fileName = `${speaker}.wav`;
      const filePath = path.join(directory, fileName);
      const handle = await fs.open(filePath, 'wx');
      await handle.write(createWavHeader({ dataBytes: 0, sampleRate, channelCount }), 0, 44, 0);
      writer = { handle, filePath, fileName, sampleRate, channelCount, dataBytes: 0 };
      this.writers.set(key, writer);
    }
    if (writer.sampleRate !== sampleRate || writer.channelCount !== channelCount) {
      throw new Error('Audio format changed during an artifact stream.');
    }
    const bytes = int16ToBuffer(samples);
    await writer.handle.write(bytes, 0, bytes.length, 44 + writer.dataBytes);
    writer.dataBytes += bytes.length;
  }

  async finalizeCall(callId) {
    if (!/^[0-9a-f-]{16,64}$/i.test(callId)) throw new TypeError('Invalid call ID.');
    const assets = [];
    for (const speaker of SPEAKERS) {
      const key = `${callId}:${speaker}`;
      const writer = this.writers.get(key);
      if (!writer) continue;
      await writer.handle.write(createWavHeader(writer), 0, 44, 0);
      await writer.handle.close();
      this.writers.delete(key);
      assets.push({
        speaker,
        fileName: writer.fileName,
        contentType: 'audio/wav',
        bytes: writer.dataBytes + 44,
        durationMs: Math.round(writer.dataBytes / (writer.sampleRate * writer.channelCount * 2) * 1000),
        sampleRate: writer.sampleRate,
        channelCount: writer.channelCount,
      });
    }
    return assets;
  }

  async deleteCall(callId) {
    if (!/^[0-9a-f-]{16,64}$/i.test(callId)) throw new TypeError('Invalid call ID.');
    for (const speaker of SPEAKERS) {
      const key = `${callId}:${speaker}`;
      const writer = this.writers.get(key);
      if (writer) {
        await writer.handle.close();
        this.writers.delete(key);
      }
    }
    await fs.rm(path.join(this.rootDir, callId), { recursive: true, force: true });
  }
}

module.exports = { AudioArtifactStore, createWavHeader };