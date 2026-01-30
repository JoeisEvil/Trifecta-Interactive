/**
 * Sonance Audio Engine - Reverb Impulse Response Generator
 * Creates algorithmic impulse responses for convolution reverb
 */

export interface ReverbConfig {
  duration?: number;    // Reverb tail length in seconds (default: 2)
  decay?: number;       // Decay rate (default: 2)
  reverse?: boolean;    // Reverse reverb effect (default: false)
}

const DEFAULT_REVERB_CONFIG: Required<ReverbConfig> = {
  duration: 2,
  decay: 2,
  reverse: false,
};

/**
 * Generate a reverb impulse response buffer
 */
export function generateReverbImpulse(
  context: AudioContext,
  config?: ReverbConfig
): AudioBuffer {
  const opts = { ...DEFAULT_REVERB_CONFIG, ...config };
  const sampleRate = context.sampleRate;
  const length = Math.floor(opts.duration * sampleRate);

  // Stereo impulse response
  const buffer = context.createBuffer(2, length, sampleRate);
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = buffer.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / length;

    // Exponential decay envelope
    const envelope = Math.pow(1 - t, opts.decay);

    // Random noise with decay
    const leftNoise = (Math.random() * 2 - 1) * envelope;
    const rightNoise = (Math.random() * 2 - 1) * envelope;

    if (opts.reverse) {
      leftChannel[length - 1 - i] = leftNoise;
      rightChannel[length - 1 - i] = rightNoise;
    } else {
      leftChannel[i] = leftNoise;
      rightChannel[i] = rightNoise;
    }
  }

  return buffer;
}

/**
 * Generate a hall-style reverb with early reflections
 */
export function generateHallReverb(
  context: AudioContext,
  duration: number = 2.5
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.floor(duration * sampleRate);

  const buffer = context.createBuffer(2, length, sampleRate);
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = buffer.getChannelData(1);

  // Early reflections (first 100ms)
  const earlyLength = Math.floor(0.1 * sampleRate);
  const earlyTaps = [0.01, 0.02, 0.03, 0.05, 0.07, 0.09];

  for (const tap of earlyTaps) {
    const tapSample = Math.floor(tap * sampleRate);
    if (tapSample < length) {
      const gain = 0.5 * (1 - tap / 0.1);
      leftChannel[tapSample] += gain * (Math.random() * 0.5 + 0.5);
      rightChannel[tapSample] += gain * (Math.random() * 0.5 + 0.5);
    }
  }

  // Late reverb tail
  for (let i = earlyLength; i < length; i++) {
    const t = (i - earlyLength) / (length - earlyLength);
    const envelope = Math.pow(1 - t, 2.5);

    leftChannel[i] += (Math.random() * 2 - 1) * envelope * 0.5;
    rightChannel[i] += (Math.random() * 2 - 1) * envelope * 0.5;
  }

  return buffer;
}

/**
 * Generate a small room reverb
 */
export function generateRoomReverb(
  context: AudioContext,
  duration: number = 0.8
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.floor(duration * sampleRate);

  const buffer = context.createBuffer(2, length, sampleRate);
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = buffer.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / length;
    // Faster decay for smaller space
    const envelope = Math.pow(1 - t, 4);

    leftChannel[i] = (Math.random() * 2 - 1) * envelope;
    rightChannel[i] = (Math.random() * 2 - 1) * envelope;
  }

  return buffer;
}
