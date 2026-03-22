import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Noise } from '@react-three/postprocessing';
import { XR, createXRStore, useXR } from '@react-three/xr';
import * as THREE from 'three';
import { useAudio } from './AudioProvider';
import { useListener, useSpatialSound } from './audio';
import type { AudioEngine } from './audio';

export const xrStore = createXRStore();

const BLOOM_INTENSITY = 1.5;
const BLOOM_THRESHOLD = 0.2;
const NOISE_OPACITY = 0.06;
const EMISSIVE_INTENSITY_PYRAMID = 4;
const EMISSIVE_INTENSITY_CUBE = 3;
const EMISSIVE_INTENSITY_SPHERE = 5;
const ROTATION_SPEED = 0.3;
const HOVER_SCALE = 1.3;
const STAR_COUNT = 1000;
const STAR_SPEED = 1;
const VR_ORBIT_RADIUS = 2;

function calculateRadius(width: number): number {
  const minRadius = 1;
  const scaleFactor = 550;
  return Math.max(minRadius, width / scaleFactor);
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

function useGrabSpin() {
  const { gl } = useThree();
  const velocityRef = useRef(0);
  const grabbingRef = useRef<number | null>(null);
  const lastYawRef = useRef<number | null>(null);
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));

  useEffect(() => {
    const controller0 = gl.xr.getController(0);
    const controller1 = gl.xr.getController(1);

    const onSqueezeStart = (index: number) => () => {
      grabbingRef.current = index;
      lastYawRef.current = null;
    };
    const onSqueezeEnd = (index: number) => () => {
      if (grabbingRef.current === index) {
        grabbingRef.current = null;
        lastYawRef.current = null;
      }
    };

    controller0.addEventListener('squeezestart', onSqueezeStart(0));
    controller0.addEventListener('squeezeend', onSqueezeEnd(0));
    controller1.addEventListener('squeezestart', onSqueezeStart(1));
    controller1.addEventListener('squeezeend', onSqueezeEnd(1));

    return () => {
      controller0.removeEventListener('squeezestart', onSqueezeStart(0));
      controller0.removeEventListener('squeezeend', onSqueezeEnd(0));
      controller1.removeEventListener('squeezestart', onSqueezeStart(1));
      controller1.removeEventListener('squeezeend', onSqueezeEnd(1));
    };
  }, [gl]);

  useFrame((state, delta) => {
    if (grabbingRef.current !== null && delta > 0) {
      const controller = state.gl.xr.getController(grabbingRef.current);
      euler.current.setFromQuaternion(controller.quaternion, 'YXZ');
      const yaw = euler.current.y;

      if (lastYawRef.current !== null) {
        let deltaYaw = yaw - lastYawRef.current;
        // Handle ±π wraparound
        if (deltaYaw > Math.PI) deltaYaw -= 2 * Math.PI;
        if (deltaYaw < -Math.PI) deltaYaw += 2 * Math.PI;
        velocityRef.current = deltaYaw / delta;
      }
      lastYawRef.current = yaw;
    } else {
      velocityRef.current *= 0.95;
      if (Math.abs(velocityRef.current) < 0.01) {
        velocityRef.current = 0;
      }
    }
  });

  return velocityRef;
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
    if (loopLoaded && !loopStarted.current && engine?.isReady) {
      loopStarted.current = true;
      playLoop();
    }

    if (meshRef.current) {
      rotationRef.current += delta * 0.5 * speedRef.current * directionRef.current;
      meshRef.current.rotation.y = rotationRef.current;

      const targetScale = hovered ? HOVER_SCALE : 1;
      scaleRef.current += (targetScale - scaleRef.current) * 0.03;
      meshRef.current.scale.setScalar(scaleRef.current);

      const worldPos = new THREE.Vector3();
      meshRef.current.getWorldPosition(worldPos);
      setPosition(worldPos.x, worldPos.y, worldPos.z);
      setLoopPosition(worldPos.x, worldPos.y, worldPos.z);
    }

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
    if (loopLoaded && !loopStarted.current && engine?.isReady) {
      loopStarted.current = true;
      playLoop();
    }

    if (meshRef.current) {
      rotationRef.current += delta * 0.4 * speedRef.current * directionRef.current;
      meshRef.current.rotation.y = rotationRef.current;

      const targetScale = hovered ? HOVER_SCALE : 1;
      scaleRef.current += (targetScale - scaleRef.current) * 0.03;
      meshRef.current.scale.setScalar(scaleRef.current);

      const worldPos = new THREE.Vector3();
      meshRef.current.getWorldPosition(worldPos);
      setPosition(worldPos.x, worldPos.y, worldPos.z);
      setLoopPosition(worldPos.x, worldPos.y, worldPos.z);
    }

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
  const baseScaleX = 1.6;
  const baseScaleY = 1;
  const baseScaleZ = 1;

  const x = orbitRadius * Math.cos(angleOffset);
  const z = orbitRadius * Math.sin(angleOffset);

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
    if (loopLoaded && !loopStarted.current && engine?.isReady) {
      loopStarted.current = true;
      playLoop();
    }

    if (meshRef.current) {
      rotationRef.current += delta * 0.6 * speedRef.current * directionRef.current;
      meshRef.current.rotation.y = rotationRef.current;

      const targetScale = hovered ? HOVER_SCALE : 1;
      scaleRef.current += (targetScale - scaleRef.current) * 0.03;
      meshRef.current.scale.set(
        baseScaleX * scaleRef.current,
        baseScaleY * scaleRef.current,
        baseScaleZ * scaleRef.current
      );

      const worldPos = new THREE.Vector3();
      meshRef.current.getWorldPosition(worldPos);
      setPosition(worldPos.x, worldPos.y, worldPos.z);
      setLoopPosition(worldPos.x, worldPos.y, worldPos.z);
    }

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
  grabVelocityRef: React.MutableRefObject<number>;
  orbitRadius: number;
  engine: AudioEngine | null;
}

function OrbitingShapes({ grabVelocityRef, orbitRadius, engine }: OrbitingShapesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  const directionRef = useRef(1);
  const speedRef = useRef(1);
  const currentSpeed = useRef(ROTATION_SPEED);
  const elapsedTime = useRef(0);
  const entranceDuration = 2;
  const entranceSpinSpeed = 10;

  useFrame((state, delta) => {
    if (groupRef.current) {
      elapsedTime.current += delta;

      const velocity = grabVelocityRef.current;
      const isActive = Math.abs(velocity) > 0.1;

      if (isActive) {
        directionRef.current = velocity > 0 ? 1 : -1;
      }

      const targetBoost = isActive ? Math.min(Math.abs(velocity) * 0.5, 3) : 0;
      const targetSpeed = ROTATION_SPEED + targetBoost;

      const easeRate = isActive ? 0.1 : 0.05;
      currentSpeed.current += (targetSpeed - currentSpeed.current) * easeRate;

      const boostMultiplier = (currentSpeed.current - ROTATION_SPEED) * 2;
      speedRef.current = 1 + boostMultiplier;

      let entranceMultiplier = 1;
      if (elapsedTime.current < entranceDuration) {
        const progress = elapsedTime.current / entranceDuration;
        const easeOut = 1 - Math.pow(1 - progress, 3);
        entranceMultiplier = entranceSpinSpeed - (entranceSpinSpeed - 1) * easeOut;
      }

      rotationRef.current += delta * currentSpeed.current * directionRef.current * entranceMultiplier;
      groupRef.current.rotation.y = rotationRef.current;

      // In VR, orbit around the headset position
      if (state.gl.xr.isPresenting) {
        groupRef.current.position.copy(state.camera.position);
      } else {
        groupRef.current.position.set(0, 0, 0);
      }
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

function PostProcessing({ disabled }: { disabled?: boolean }) {
  if (disabled) return null;
  return (
    <EffectComposer>
      <Bloom
        intensity={BLOOM_INTENSITY}
        luminanceThreshold={BLOOM_THRESHOLD}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <Noise opacity={NOISE_OPACITY} />
    </EffectComposer>
  );
}

function SpatialAudioSync({ engine }: { engine: AudioEngine | null }) {
  useListener(engine);
  return null;
}

interface SceneProps {
  orbitRadius: number;
  engine: AudioEngine | null;
}

function Scene({ orbitRadius, engine }: SceneProps) {
  const grabVelocityRef = useGrabSpin();
  const isInVR = useXR((xr) => xr.mode === 'immersive-vr');
  const activeRadius = isInVR ? VR_ORBIT_RADIUS : orbitRadius;

  useEffect(() => {
    if (!isInVR || !engine) return;

    const ctx = engine.getContext();
    console.log('[VR Audio] Entered VR');
    console.log('[VR Audio] Context state:', ctx.state);
    console.log('[VR Audio] Engine isReady:', engine.isReady);
    console.log('[VR Audio] Master volume:', engine.masterVolume);
    console.log('[VR Audio] Sound IDs:', engine.getSoundIds());

    const resumeAndPlay = async () => {
      if (ctx.state === 'suspended') {
        await ctx.resume();
        console.log('[VR Audio] Context resumed, new state:', ctx.state);
      }
      engine.masterVolume = 0.7;
      console.log('[VR Audio] Set master volume to 0.7');

      // Force restart all sounds
      for (const id of engine.getSoundIds()) {
        const sound = engine.getSound(id);
        if (sound?.isLoaded) {
          sound.stop();
          sound.play();
          console.log('[VR Audio] Restarted sound:', id);
        }
      }
    };

    resumeAndPlay().catch((e) => console.error('[VR Audio] Error:', e));
  }, [isInVR, engine]);

  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 5, 20]} />

      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#22C55E" />
      <pointLight position={[-10, -10, -10]} intensity={0.8} color="#EF4444" />

      <SpatialAudioSync engine={engine} />
      <OrbitingShapes grabVelocityRef={grabVelocityRef} orbitRadius={activeRadius} engine={engine} />
      <Stars
        radius={100}
        depth={50}
        count={isInVR ? 300 : STAR_COUNT}
        factor={2}
        saturation={0}
        fade
        speed={STAR_SPEED}
      />
      <PostProcessing disabled={isInVR} />
    </>
  );
}

export default function HeroScene() {
  const orbitRadius = useResponsiveOrbitRadius();
  const { engine, state } = useAudio();

  useEffect(() => {
    console.log(`AudioEngine state: ${state}`);
  }, [state]);

  return (
    <Canvas
      camera={{ position: [0, 2.5, 6], fov: 50 }}
      className="three-canvas"
      dpr={[1, 2]}
    >
      <XR store={xrStore}>
        <Scene orbitRadius={orbitRadius} engine={engine} />
      </XR>
    </Canvas>
  );
}
