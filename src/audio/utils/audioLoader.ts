/**
 * Sonance Audio Engine - Audio Buffer Loader with Cache
 */

const bufferCache = new Map<string, AudioBuffer>();

/**
 * Load and decode an audio file, with caching
 */
export async function loadAudioBuffer(
  context: AudioContext,
  url: string
): Promise<AudioBuffer> {
  const cached = bufferCache.get(url);
  if (cached) {
    return cached;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${url} (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await context.decodeAudioData(arrayBuffer);

  bufferCache.set(url, audioBuffer);
  return audioBuffer;
}

/**
 * Check if a buffer is cached
 */
export function isBufferCached(url: string): boolean {
  return bufferCache.has(url);
}

/**
 * Remove a buffer from cache
 */
export function removeFromCache(url: string): boolean {
  return bufferCache.delete(url);
}

/**
 * Clear the entire buffer cache
 */
export function clearCache(): void {
  bufferCache.clear();
}

/**
 * Get the current cache size
 */
export function getCacheSize(): number {
  return bufferCache.size;
}
