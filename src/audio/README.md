# Sonance Audio Engine

A 3D spatial audio library for Three.js and React, designed for immersive web experiences.

## Features

- **3D Spatial Audio** - HRTF panning with distance-based attenuation
- **Seamless Crossfade Looping** - Gapless loops with configurable crossfade duration
- **Click-Free Playback** - Automatic fade-out on stop to prevent audio artifacts
- **Listener Sync** - Automatic synchronization with Three.js camera
- **React Hooks** - Easy integration with React and React Three Fiber
- **Audio Buffer Caching** - Efficient memory management with automatic caching

## Installation

The audio engine is located in `/src/audio/`. Import from the main index:

```typescript
import {
  AudioEngine,
  useAudioEngine,
  useSpatialSound,
  useListener
} from './audio';
```

## Quick Start

### 1. Wrap your app with AudioProvider

```tsx
import { AudioProvider } from './AudioProvider';

function App() {
  return (
    <AudioProvider>
      <YourApp />
    </AudioProvider>
  );
}
```

### 2. Sync listener with camera (inside Canvas)

```tsx
import { useAudio } from './AudioProvider';
import { useListener } from './audio';

function AudioSync() {
  const { engine } = useAudio();
  useListener(engine);
  return null;
}

// Add inside your Canvas:
<Canvas>
  <AudioSync />
  {/* ... */}
</Canvas>
```

### 3. Add spatial sounds to objects

```tsx
import { useSpatialSound } from './audio';

function MyObject({ engine }) {
  const { play, stop, setPosition, isLoaded } = useSpatialSound(
    engine,
    'my-sound',
    {
      url: '/sounds/effect.wav',
      volume: 0.5,
      spatial: {
        position: { x: 0, y: 0, z: 0 },
        refDistance: 1,
        rolloffFactor: 1,
      },
    }
  );

  // Update position each frame
  useFrame(() => {
    if (meshRef.current) {
      const pos = meshRef.current.position;
      setPosition(pos.x, pos.y, pos.z);
    }
  });

  return <mesh ref={meshRef} onClick={() => isLoaded && play()} />;
}
```

## Core Classes

### AudioEngine

Central controller that manages the Web Audio context, sounds, listener, and master effects.

```typescript
const engine = new AudioEngine({
  autoResume: true,    // Auto-resume on user gesture (default: true)
  masterVolume: 1,     // Master volume 0-1 (default: 1)
  reverbWet: 0.15,     // Reverb wet level 0-1 (default: 0.15)
  reverbDry: 1,        // Reverb dry level 0-1 (default: 1)
});

await engine.init();

// Create sounds
const sound = engine.createSound('id', config);

// Control
engine.masterVolume = 0.5;
engine.reverbWet = 0.2;      // Increase reverb
engine.setReverbMix(0.3);    // Set wet/dry mix (0=dry, 1=wet)
engine.stopAllSounds();
await engine.dispose();
```

### Sound

3D positioned audio source with spatial properties.

```typescript
const sound = engine.createSound('my-sound', {
  url: '/sounds/effect.wav',
  volume: 0.5,
  loop: false,
  offset: 0,              // Start position in seconds
  crossfadeDuration: 0,   // Crossfade for seamless looping
  spatial: {
    position: { x: 0, y: 0, z: 0 },
    panningModel: 'HRTF',
    distanceModel: 'inverse',
    refDistance: 1,
    maxDistance: 10000,
    rolloffFactor: 1,
  },
});

await sound.load();
sound.play();
sound.stop();
sound.setPosition(x, y, z);
sound.fadeTo(targetVolume, duration);
```

### Listener

Represents the "ear" position, synced with Three.js camera.

```typescript
// Automatically handled by useListener hook
engine.updateListener(camera);
```

## Configuration Options

### SoundConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `url` | string | required | Audio file URL |
| `volume` | number | 1 | Volume 0-1 |
| `loop` | boolean | false | Loop playback |
| `offset` | number | 0 | Start offset in seconds |
| `crossfadeDuration` | number | 0 | Crossfade duration for seamless looping |
| `spatial` | SpatialConfig | defaults | Spatial audio settings |

### SpatialConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `position` | Vector3 | {0,0,0} | 3D position |
| `panningModel` | 'HRTF' \| 'equalpower' | 'HRTF' | Panning algorithm |
| `distanceModel` | 'linear' \| 'inverse' \| 'exponential' | 'inverse' | Distance attenuation |
| `refDistance` | number | 1 | Reference distance |
| `maxDistance` | number | 10000 | Maximum distance |
| `rolloffFactor` | number | 1 | Attenuation rate |

## React Hooks

### useAudioEngine

Manages AudioEngine lifecycle.

```typescript
const { engine, state, isReady, resume } = useAudioEngine();
```

### useListener

Syncs audio listener with Three.js camera each frame. Must be used inside Canvas.

```typescript
useListener(engine);
```

### useSpatialSound

Manages a single spatial sound instance.

```typescript
const {
  sound,
  play,
  stop,
  setPosition,
  setVolume,
  fadeTo,
  isLoaded,
  isPlaying,
  state,
} = useSpatialSound(engine, 'sound-id', config);
```

## Seamless Looping

For gapless loops, use the `crossfadeDuration` option. This creates overlapping playback with crossfade at loop boundaries.

```typescript
const { play } = useSpatialSound(engine, 'ambient-loop', {
  url: '/sounds/ambient_120bpm_4bar.wav',
  loop: true,
  volume: 0.3,
  crossfadeDuration: 0.25,  // 0.25s crossfade (half beat at 120 BPM)
  spatial: { /* ... */ },
});
```

**How it works:**
- Uses `setInterval` scheduler for reliable timing
- Schedules next loop iteration 1 second ahead
- Fades out ending source while fading in new source
- Handles cleanup of finished sources automatically

**Recommended crossfade durations:**
- Percussive loops: 0.1-0.25s (tight)
- Ambient/pad loops: 0.25-0.5s (smooth)
- Musical loops at 120 BPM: 0.25s (half beat) or 0.5s (one beat)

## Master Reverb

The engine includes a convolution reverb on the master bus for spatial depth.

```typescript
// Configure at init
const engine = new AudioEngine({
  reverbWet: 0.15,  // Subtle reverb
  reverbDry: 1,
});

// Adjust at runtime
engine.reverbWet = 0.3;           // More reverb
engine.reverbDry = 0.8;           // Slightly reduce dry
engine.setReverbMix(0.25);        // Convenience method (0=dry, 1=wet)
```

**Signal flow:**
```
Sounds -> masterGain -> dryGain ---------> destination
                    \-> convolver -> wetGain -> destination
```

The reverb uses a programmatically generated hall impulse response with early reflections and a natural decay tail.

## Click-Free Audio

The engine automatically prevents clicks/pops when stopping sounds:

- **Stop fade**: 30ms fade-out before stopping source
- **Play restore**: Cancels pending fades and restores volume on play
- **Scheduled stop**: Source actually stops after fade completes

This is handled automatically - no configuration needed.

## Audio File Guidelines

### One-shot sounds
- Can have silence at start for natural attack
- Use `offset` to skip lead-in silence if needed

### Loop sounds
- Should be cut precisely for seamless looping
- Use `crossfadeDuration` to smooth any imperfections
- For musical content, ensure loop length matches tempo grid

### Supported formats
- WAV (recommended for quality)
- MP3
- OGG
- Any format supported by Web Audio API

## Web Audio Best Practices

The engine follows Web Audio best practices:

1. **Context State**: Created suspended, resumes on user gesture
2. **User Gesture Handling**: Auto-resume on click/touch/keydown
3. **Memory Management**: Buffer caching with cleanup on dispose
4. **Smooth Automation**: Uses `setValueAtTime()` and `linearRampToValueAtTime()`
5. **Source Recreation**: Creates new source nodes for each playback (required by Web Audio)

## File Structure

```
/src/audio/
  /core/
    AudioEngine.ts    # Main controller
    types.ts          # TypeScript interfaces
    constants.ts      # Default values
  /spatial/
    Sound.ts          # 3D spatial sound class
    Listener.ts       # Camera sync for listener
  /utils/
    audioLoader.ts    # Buffer loading with cache
    mathUtils.ts      # Vector/interpolation helpers
    toneGenerator.ts  # Programmatic tone generation
  /hooks/
    useAudioEngine.ts    # Engine lifecycle hook
    useListener.ts       # Camera-listener sync hook
    useSpatialSound.ts   # Spatial sound hook
    useGeneratedTone.ts  # Generated tone hook
  index.ts            # Public API exports
```

## Future Enhancements

- Phase 2: RTPC parameter system, doppler effect
- Phase 3: Music class with BPM, markers, loop points
- Phase 4: AdaptiveMusic with multi-stem sync
- Phase 5: Reverb via ConvolverNode, filters
