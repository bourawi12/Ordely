function mixToMono(samples, channelCount) {
  if (!Number.isInteger(channelCount) || channelCount < 1) {
    throw new TypeError('channelCount must be a positive integer.');
  }
  if (samples.length % channelCount !== 0) {
    throw new RangeError('Interleaved PCM sample count must be divisible by channelCount.');
  }
  if (channelCount === 1) return new Int16Array(samples);

  const mono = new Int16Array(samples.length / channelCount);
  for (let frame = 0; frame < mono.length; frame += 1) {
    let total = 0;
    for (let channel = 0; channel < channelCount; channel += 1) {
      total += samples[frame * channelCount + channel];
    }
    mono[frame] = Math.max(-32768, Math.min(32767, Math.round(total / channelCount)));
  }
  return mono;
}

function resamplePcm16(samples, sourceRate, targetRate) {
  if (!Number.isFinite(sourceRate) || sourceRate <= 0 || !Number.isFinite(targetRate) || targetRate <= 0) {
    throw new RangeError('Sample rates must be positive numbers.');
  }
  if (sourceRate === targetRate) return new Int16Array(samples);
  if (samples.length === 0) return new Int16Array();

  const outputLength = Math.max(1, Math.round(samples.length * targetRate / sourceRate));
  const output = new Int16Array(outputLength);
  const step = sourceRate / targetRate;
  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = Math.min(index * step, samples.length - 1);
    const left = Math.floor(sourcePosition);
    const right = Math.min(left + 1, samples.length - 1);
    const fraction = sourcePosition - left;
    output[index] = Math.max(-32768, Math.min(32767,
      Math.round(samples[left] + (samples[right] - samples[left]) * fraction)));
  }
  return output;
}

function chunkPcm(samples, sampleRate, frameDurationMs = 10) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isFinite(frameDurationMs) || frameDurationMs <= 0) {
    throw new RangeError('Sample rate and frame duration must be positive numbers.');
  }
  const frameSize = Math.round(sampleRate * frameDurationMs / 1000);
  if (frameSize < 1) throw new RangeError('Frame duration is too short for the sample rate.');

  const chunks = [];
  for (let offset = 0; offset < samples.length; offset += frameSize) {
    const frameCount = Math.min(frameSize, samples.length - offset);
    const frame = new Int16Array(frameSize);
    frame.set(samples.subarray(offset, offset + frameCount));
    chunks.push({ samples: frame, sampleRate, channelCount: 1, bitsPerSample: 16, numberOfFrames: frameSize });
  }
  return chunks;
}

function int16ToBuffer(samples) {
  const buffer = Buffer.allocUnsafe(samples.length * 2);
  for (let index = 0; index < samples.length; index += 1) buffer.writeInt16LE(samples[index], index * 2);
  return buffer;
}

function bufferToInt16(buffer) {
  if (buffer.length % 2 !== 0) throw new RangeError('PCM16 byte length must be even.');
  const samples = new Int16Array(buffer.length / 2);
  for (let index = 0; index < samples.length; index += 1) samples[index] = buffer.readInt16LE(index * 2);
  return samples;
}

module.exports = { bufferToInt16, chunkPcm, int16ToBuffer, mixToMono, resamplePcm16 };