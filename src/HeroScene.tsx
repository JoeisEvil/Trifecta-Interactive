import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Scanline } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useAudio } from './AudioProvider';
import { useListener, useSpatialSound } from './audio';
import type { AudioEngine } from './audio';

// Hardcoded values (previously from controls)
const BLOOM_INTENSITY = 1.5;
const BLOOM_THRESHOLD = 0.2;
const SCANLINE_DENSITY = 1.5;
const SCANLINE_OPACITY = 0.15;
const NOISE_OPACITY = 0.16;
const EMISSIVE_INTENSITY_PYRAMID = 4;
const EMISSIVE_INTENSITY_CUBE = 3;
const EMISSIVE_INTENSITY_SPHERE = 5; // Boosted to fix red bloom
const ROTATION_SPEED = 0.3;
const HOVER_SCALE = 1.3;
const STAR_COUNT = 1000;
const STAR_SPEED = 1;

function calculateRadius(width: number): number {
  // Mobile: 1, Desktop (1024+): 2.5
  // Linear interpolation between 480px and 1024px
  const minWidth = 480;
  const maxWidth = 1024;
  const minRadius = 1;
  const maxRadius = 2.5;

  if (width <= minWidth) return minRadius;
  if (width >= maxWidth) return maxRadius;

  const t = (width - minWidth) / (maxWidth - minWidth);
  return minRadius + t * (maxRadius - minRadius);
}

function useResponsiveOrbitRadius() {
  const [radius, setRadius] = useState(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    return calculateRadius(width);
  });

  useEffect(() => {
    const handleResize = () => {
      setRadius(calculateRadius(window.innerWidth));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return radius;
}

function useScrollData() {
  const scrollRef = useRef({ position: 0, velocity: 0 });
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());

  useEffect(() => {
    const handleScroll = () => {
      const now = Date.now();
      const dt = (now - lastScrollTime.current) / 1000;
      const scrollY = window.scrollY;

      if (dt > 0) {
        scrollRef.current.velocity = (scrollY - lastScrollY.current) / dt;
      }
      scrollRef.current.position = scrollY;

      lastScrollY.current = scrollY;
      lastScrollTime.current = now;
    };

    // Decay velocity when no scroll events
    const decayInterval = setInterval(() => {
      const timeSinceScroll = Date.now() - lastScrollTime.current;
      if (timeSinceScroll > 50) {
        scrollRef.current.velocity *= 0.9; // Decay velocity
        if (Math.abs(scrollRef.current.velocity) < 1) {
          scrollRef.current.velocity = 0;
        }
      }
    }, 16);

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(decayInterval);
    };
  }, []);
  return scrollRef;
}

interface ShapeProps {
  directionRef: React.MutableRefObject<number>;
  speedRef: React.MutableRefObject<number>;
  emissiveIntensity: number;
  orbitRadius: number;
  angleOffset: number;
  engine: AudioEngine | null;
}

function Pyramid({ directionRef, speedRef, emissiveIntensity, orbitRadius, angleOffset, engine }: ShapeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const rotationRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const scaleRef = useRef(1);
  const wasHovered = useRef(false);
  const hasPlayedThisHover = useRef(false);
  const loopStarted = useRef(false);

  const x = orbitRadius * Math.cos(angleOffset);
  const z = orbitRadius * Math.sin(angleOffset);

  // Persistent loop sound
  const {
    play: playLoop,
    setPosition: setLoopPosition,
    isLoaded: loopLoaded,
  } = useSpatialSound(engine, 'pyramid-loop', {
    url: '/sound/Pyramid_120_4bar_loop.wav',
    loop: true,
    volume: 0.3,
    crossfadeDuration: 0.25,
    spatial: {
      position: { x, y: 0, z },
      refDistance: 1,
      rolloffFactor: 1,
    },
  });

  // One-shot hover sound (offset 0.5s = 1 beat at 120 BPM)
  const { play, stop, setPosition, isLoaded } = useSpatialSound(
    engine,
    'pyramid-hover',
    {
      url: '/sound/Pyramid_1beat_120.wav',
      loop: false,
      volume: 0.5,
      offset: 0.5,
      spatial: {
        position: { x, y: 0, z },
        refDistance: 1,
        rolloffFactor: 1,
      },
    }
  );

  useFrame((_, delta) => {
    // Start loop when ready
    if (loopLoaded && !loopStarted.current && engine?.isReady) {
      loopStarted.current = true;
      playLoop();
    }

    if (meshRef.current) {
      rotationRef.current += delta * 0.5 * speedRef.current * directionRef.current;
      meshRef.current.rotation.y = rotationRef.current;

      // Smooth scale transition on hover
      const targetScale = hovered ? HOVER_SCALE : 1;
      scaleRef.current += (targetScale - scaleRef.current) * 0.03;
      meshRef.current.scale.setScalar(scaleRef.current);

      // Update sound positions to follow mesh world position
      const worldPos = new THREE.Vector3();
      meshRef.current.getWorldPosition(worldPos);
      setPosition(worldPos.x, worldPos.y, worldPos.z);
      setLoopPosition(worldPos.x, worldPos.y, worldPos.z);
    }

    // Play hover sound once per hover session
    if (hovered !== wasHovered.current) {
      wasHovered.current = hovered;
      if (hovered && isLoaded && !hasPlayedThisHover.current) {
        hasPlayedThisHover.current = true;
        play();
      } else if (!hovered) {
        hasPlayedThisHover.current = false;
        stop();
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[x, 0, z]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <coneGeometry args={[0.6, 1.2, 4]} />
      <meshStandardMaterial
        color="#1E40AF"
        emissive="#60A5FA"
        emissiveIntensity={emissiveIntensity}
        metalness={0.8}
        roughness={0.2}
        toneMapped={false}
      />
    </mesh>
  );
}

function Cube({ directionRef, speedRef, emissiveIntensity, orbitRadius, angleOffset, engine }: ShapeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const rotationRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const scaleRef = useRef(1);
  const wasHovered = useRef(false);
  const hasPlayedThisHover = useRef(false);
  const loopStarted = useRef(false);

  const x = orbitRadius * Math.cos(angleOffset);
  const z = orbitRadius * Math.sin(angleOffset);

  // Persistent loop sound
  const {
    play: playLoop,
    setPosition: setLoopPosition,
    isLoaded: loopLoaded,
  } = useSpatialSound(engine, 'cube-loop', {
    url: '/sound/Square_120_4bar_loop.wav',
    loop: true,
    volume: 0.3,
    crossfadeDuration: 0.25,
    spatial: {
      position: { x, y: 0, z },
      refDistance: 1,
      rolloffFactor: 1,
    },
  });

  // One-shot hover sound (offset 0.5s = 1 beat at 120 BPM)
  const { play, stop, setPosition, isLoaded } = useSpatialSound(
    engine,
    'cube-hover',
    {
      url: '/sound/Square_1beat_120.wav',
      loop: false,
      volume: 0.5,
      offset: 0.5,
      spatial: {
        position: { x, y: 0, z },
        refDistance: 1,
        rolloffFactor: 1,
      },
    }
  );

  useFrame((_, delta) => {
    // Start loop when ready
    if (loopLoaded && !loopStarted.current && engine?.isReady) {
      loopStarted.current = true;
      playLoop();
    }

    if (meshRef.current) {
      rotationRef.current += delta * 0.4 * speedRef.current * directionRef.current;
      meshRef.current.rotation.y = rotationRef.current;

      // Smooth scale transition on hover
      const targetScale = hovered ? HOVER_SCALE : 1;
      scaleRef.current += (targetScale - scaleRef.current) * 0.03;
      meshRef.current.scale.setScalar(scaleRef.current);

      // Update sound positions to follow mesh world position
      const worldPos = new THREE.Vector3();
      meshRef.current.getWorldPosition(worldPos);
      setPosition(worldPos.x, worldPos.y, worldPos.z);
      setLoopPosition(worldPos.x, worldPos.y, worldPos.z);
    }

    // Play hover sound once per hover session
    if (hovered !== wasHovered.current) {
      wasHovered.current = hovered;
      if (hovered && isLoaded && !hasPlayedThisHover.current) {
        hasPlayedThisHover.current = true;
        play();
      } else if (!hovered) {
        hasPlayedThisHover.current = false;
        stop();
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[x, 0, z]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshStandardMaterial
        color="#166534"
        emissive="#22C55E"
        emissiveIntensity={emissiveIntensity}
        metalness={0.8}
        roughness={0.2}
        toneMapped={false}
      />
    </mesh>
  );
}

function Sphere({ directionRef, speedRef, emissiveIntensity, orbitRadius, angleOffset, engine }: ShapeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const rotationRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const scaleRef = useRef(1);
  const wasHovered = useRef(false);
  const hasPlayedThisHover = useRef(false);
  const loopStarted = useRef(false);
  const baseScaleX = 1.6; // Horizontally oblong
  const baseScaleY = 1;
  const baseScaleZ = 1;

  const x = orbitRadius * Math.cos(angleOffset);
  const z = orbitRadius * Math.sin(angleOffset);

  // Persistent loop sound
  const {
    play: playLoop,
    setPosition: setLoopPosition,
    isLoaded: loopLoaded,
  } = useSpatialSound(engine, 'sphere-loop', {
    url: '/sound/Oval_120_4bar_loop.wav',
    loop: true,
    volume: 0.3,
    crossfadeDuration: 0.25,
    spatial: {
      position: { x, y: 0, z },
      refDistance: 1,
      rolloffFactor: 1,
    },
  });

  // One-shot hover sound (offset 0.5s = 1 beat at 120 BPM)
  const { play, stop, setPosition, isLoaded } = useSpatialSound(
    engine,
    'sphere-hover',
    {
      url: '/sound/Oval_1beat_120.wav',
      loop: false,
      volume: 0.5,
      offset: 0.5,
      spatial: {
        position: { x, y: 0, z },
        refDistance: 1,
        rolloffFactor: 1,
      },
    }
  );

  useFrame((_, delta) => {
    // Start loop when ready
    if (loopLoaded && !loopStarted.current && engine?.isReady) {
      loopStarted.current = true;
      playLoop();
    }

    if (meshRef.current) {
      rotationRef.current += delta * 0.6 * speedRef.current * directionRef.current;
      meshRef.current.rotation.y = rotationRef.current;

      // Smooth scale transition on hover
      const targetScale = hovered ? HOVER_SCALE : 1;
      scaleRef.current += (targetScale - scaleRef.current) * 0.03;
      meshRef.current.scale.set(
        baseScaleX * scaleRef.current,
        baseScaleY * scaleRef.current,
        baseScaleZ * scaleRef.current
      );

      // Update sound positions to follow mesh world position
      const worldPos = new THREE.Vector3();
      meshRef.current.getWorldPosition(worldPos);
      setPosition(worldPos.x, worldPos.y, worldPos.z);
      setLoopPosition(worldPos.x, worldPos.y, worldPos.z);
    }

    // Play hover sound once per hover session
    if (hovered !== wasHovered.current) {
      wasHovered.current = hovered;
      if (hovered && isLoaded && !hasPlayedThisHover.current) {
        hasPlayedThisHover.current = true;
        play();
      } else if (!hovered) {
        hasPlayedThisHover.current = false;
        stop();
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[x, 0, z]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial
        color="#B91C1C"
        emissive="#EF4444"
        emissiveIntensity={emissiveIntensity}
        metalness={0.8}
        roughness={0.2}
        toneMapped={false}
      />
    </mesh>
  );
}

interface OrbitingShapesProps {
  scrollRef: React.MutableRefObject<{ position: number; velocity: number }>;
  orbitRadius: number;
  engine: AudioEngine | null;
}

function OrbitingShapes({ scrollRef, orbitRadius, engine }: OrbitingShapesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  const directionRef = useRef(1); // 1 = clockwise, -1 = counter-clockwise
  const speedRef = useRef(1); // Speed multiplier for shapes
  const currentSpeed = useRef(ROTATION_SPEED); // Smoothed speed value
  const elapsedTime = useRef(0); // Track time for entrance animation
  const entranceDuration = 2; // Duration of entrance spin in seconds
  const entranceSpinSpeed = 10; // Initial fast spin speed

  useFrame((_, delta) => {
    if (groupRef.current) {
      elapsedTime.current += delta;

      const velocity = scrollRef.current.velocity;
      const isScrolling = Math.abs(velocity) > 10; // pixels per second threshold

      // Only update direction when actively scrolling (persists when idle)
      if (isScrolling) {
        directionRef.current = velocity > 0 ? -1 : 1;
      }

      // Target speed based on scroll velocity
      const targetBoost = isScrolling ? Math.min(Math.abs(velocity) / 200, 3) : 0;
      const targetSpeed = ROTATION_SPEED + targetBoost;

      // Smoothly ease current speed toward target (decay to idle)
      const easeRate = isScrolling ? 0.1 : 0.05; // Faster response when scrolling, slower decay
      currentSpeed.current += (targetSpeed - currentSpeed.current) * easeRate;

      // Update speed ref for child shapes
      const boostMultiplier = (currentSpeed.current - ROTATION_SPEED) * 2;
      speedRef.current = 1 + boostMultiplier;

      // Calculate entrance animation multiplier (eases out from fast to normal)
      let entranceMultiplier = 1;
      if (elapsedTime.current < entranceDuration) {
        const progress = elapsedTime.current / entranceDuration;
        // Ease out cubic: starts fast, slows down
        const easeOut = 1 - Math.pow(1 - progress, 3);
        entranceMultiplier = entranceSpinSpeed - (entranceSpinSpeed - 1) * easeOut;
      }

      // Accumulate rotation based on direction, smoothed speed, and entrance animation
      rotationRef.current += delta * currentSpeed.current * directionRef.current * entranceMultiplier;
      groupRef.current.rotation.y = rotationRef.current;
    }
  });

  const shapeProps = {
    directionRef,
    speedRef,
    orbitRadius,
    engine,
  };

  return (
    <group ref={groupRef}>
      <Pyramid {...shapeProps} emissiveIntensity={EMISSIVE_INTENSITY_PYRAMID} angleOffset={0} />
      <Cube {...shapeProps} emissiveIntensity={EMISSIVE_INTENSITY_CUBE} angleOffset={(2 * Math.PI) / 3} />
      <Sphere {...shapeProps} emissiveIntensity={EMISSIVE_INTENSITY_SPHERE} angleOffset={(4 * Math.PI) / 3} />
    </group>
  );
}

function PostProcessing() {
  return (
    <EffectComposer>
      <Bloom
        intensity={BLOOM_INTENSITY}
        luminanceThreshold={BLOOM_THRESHOLD}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <Scanline density={SCANLINE_DENSITY} opacity={SCANLINE_OPACITY} />
      <Noise opacity={NOISE_OPACITY} />
    </EffectComposer>
  );
}

// Syncs audio listener with camera each frame
function SpatialAudioSync({ engine }: { engine: AudioEngine | null }) {
  useListener(engine);
  return null;
}

interface SceneProps {
  orbitRadius: number;
  engine: AudioEngine | null;
}

function Scene({ orbitRadius, engine }: SceneProps) {
  const scrollRef = useScrollData();

  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 5, 20]} />

      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#22C55E" />
      <pointLight position={[-10, -10, -10]} intensity={0.8} color="#EF4444" />

      <SpatialAudioSync engine={engine} />
      <OrbitingShapes scrollRef={scrollRef} orbitRadius={orbitRadius} engine={engine} />
      <Stars
        radius={100}
        depth={50}
        count={STAR_COUNT}
        factor={2}
        saturation={0}
        fade
        speed={STAR_SPEED}
      />
      <PostProcessing />
    </>
  );
}

export default function HeroScene() {
  const orbitRadius = useResponsiveOrbitRadius();
  const { engine, state } = useAudio();

  // Log audio engine state for debugging
  useEffect(() => {
    console.log(`AudioEngine state: ${state}`);
  }, [state]);

  return (
    <Canvas
      camera={{ position: [0, 2.5, 6], fov: 50 }}
      className="three-canvas"
      dpr={[1, 2]}
    >
      <Scene orbitRadius={orbitRadius} engine={engine} />
    </Canvas>
  );
}
