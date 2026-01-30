/**
 * Sonance Audio Engine - Programmatic Tone Generator
 * Creates audio buffers with synthesized tones for testing
 */

export interface ToneOptions {
  frequency?: number;
  duration?: number;
  type?: OscillatorType;
  fadeIn?: number;
  fadeOut?: number;
}

const DEFAULT_OPTIONS: Required<ToneOptions> = {
  frequency: 440,
  duration: 1,
  type: 'sine',
  fadeIn: 0.01,
  fadeOut: 0.01,
};

/**
 * Generate a simple tone as an AudioBuffer
 */
export function generateToneBuffer(
  context: AudioContext,
  options?: ToneOptions
): AudioBuffer {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sampleRate = context.sampleRate;
  const length = Math.floor(opts.duration * sampleRate);
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  const fadeInSamples = Math.floor(opts.fadeIn * sampleRate);
  const fadeOutSamples = Math.floor(opts.fadeOut * sampleRate);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample: number;

    switch (opts.type) {
      case 'sine':
        sample = Math.sin(2 * Math.PI * opts.frequency * t);
        break;
      case 'square':
        sample = Math.sin(2 * Math.PI * opts.frequency * t) > 0 ? 1 : -1;
        break;
      case 'sawtooth':
        sample = 2 * ((opts.frequency * t) % 1) - 1;
        break;
      case 'triangle':
        sample = Math.abs(4 * ((opts.frequency * t) % 1) - 2) - 1;
        break;
      default:
        sample = Math.sin(2 * Math.PI * opts.frequency * t);
    }

    // Apply fade in
    if (i < fadeInSamples) {
      sample *= i / fadeInSamples;
    }

    // Apply fade out
    if (i > length - fadeOutSamples) {
      sample *= (length - i) / fadeOutSamples;
    }

    data[i] = sample * 0.5; // Reduce amplitude to prevent clipping
  }

  return buffer;
}

/**
 * Create a URL from an AudioBuffer (for use with Sound class)
 */
export function bufferToDataUrl(buffer: AudioBuffer): string {
  // Convert to WAV format
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const data = buffer.getChannelData(0);
  const samples = data.length;
  const dataSize = samples * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, sample * 0x7fff, true);
    offset += 2;
  }

  const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
