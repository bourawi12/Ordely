"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const BLUE = "#1e63ff";
const NAVY = "#0b1f44";

/** A rounded path, closed into a tube with round caps, like the logo's smile. */
function useSmileGeometry(width: number, depth: number, radius: number) {
  return useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-width / 2, 0, 0),
      new THREE.Vector3(0, -depth * 2, 0),
      new THREE.Vector3(width / 2, 0, 0),
    );
    return {
      tube: new THREE.TubeGeometry(curve, 64, radius, 24, false),
      ends: [curve.getPoint(0), curve.getPoint(1)],
    };
  }, [width, depth, radius]);
}

function Smile({
  width,
  depth,
  radius,
  material,
}: {
  width: number;
  depth: number;
  radius: number;
  material: THREE.Material;
}) {
  const { tube, ends } = useSmileGeometry(width, depth, radius);
  return (
    <group>
      <mesh geometry={tube} material={material} />
      {ends.map((p, i) => (
        <mesh key={i} position={p} material={material}>
          <sphereGeometry args={[radius, 24, 24]} />
        </mesh>
      ))}
    </group>
  );
}

/** Gentle bobbing + slow spin + a little mouse parallax. */
function Floating({
  children,
  position,
  speed = 1,
  spin = 0.3,
  parallax = 0.4,
  baseRotation = [0, 0, 0],
}: {
  children: React.ReactNode;
  position: [number, number, number];
  speed?: number;
  spin?: number;
  parallax?: number;
  baseRotation?: [number, number, number];
}) {
  const ref = useRef<THREE.Group>(null);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock, pointer }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * speed + offset;
    g.position.x = THREE.MathUtils.lerp(g.position.x, position[0] + pointer.x * parallax, 0.05);
    g.position.y = THREE.MathUtils.lerp(
      g.position.y,
      position[1] + Math.sin(t) * 0.18 + pointer.y * parallax,
      0.05,
    );
    g.rotation.x = baseRotation[0] + Math.sin(t * 0.7) * 0.15 - pointer.y * 0.2;
    g.rotation.y = baseRotation[1] + Math.sin(t * 0.5) * spin + pointer.x * 0.3;
    g.rotation.z = baseRotation[2] + Math.cos(t * 0.6) * 0.06;
  });

  return (
    <group ref={ref} position={position} rotation={baseRotation}>
      {children}
    </group>
  );
}

function roundedSquare(size: number, r: number) {
  const s = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r);
  shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r);
  shape.quadraticCurveTo(-s, -s, -s + r, -s);
  return shape;
}

/** The Ordely app icon: a glossy rounded tile with the white smile. */
function AppIcon({ blue, white }: { blue: THREE.Material; white: THREE.Material }) {
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedSquare(1.6, 0.42), {
      depth: 0.32,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.1,
      bevelSegments: 8,
      curveSegments: 24,
    });
    g.center();
    return g;
  }, []);

  return (
    <group>
      <mesh geometry={geometry} material={blue} />
      <group position={[0, 0.05, 0.3]}>
        <Smile width={0.85} depth={0.22} radius={0.075} material={white} />
      </group>
    </group>
  );
}

/** A confirmation coin with a white check mark on its face. */
function CheckCoin({ navy, white }: { navy: THREE.Material; white: THREE.Material }) {
  const check = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    path.add(new THREE.LineCurve3(new THREE.Vector3(-0.32, 0.02, 0), new THREE.Vector3(-0.1, -0.2, 0)));
    path.add(new THREE.LineCurve3(new THREE.Vector3(-0.1, -0.2, 0), new THREE.Vector3(0.34, 0.24, 0)));
    return new THREE.TubeGeometry(path, 32, 0.07, 16, false);
  }, []);
  const corners = [
    new THREE.Vector3(-0.32, 0.02, 0),
    new THREE.Vector3(-0.1, -0.2, 0),
    new THREE.Vector3(0.34, 0.24, 0),
  ];

  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={navy}>
        <cylinderGeometry args={[0.75, 0.75, 0.24, 64]} />
      </mesh>
      <group position={[0, 0, 0.14]}>
        <mesh geometry={check} material={white} />
        {corners.map((p, i) => (
          <mesh key={i} position={p} material={white}>
            <sphereGeometry args={[0.07, 16, 16]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Objects() {
  const { viewport } = useThree();
  const materials = useMemo(
    () => ({
      blue: new THREE.MeshPhysicalMaterial({
        color: BLUE,
        roughness: 0.25,
        metalness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
      }),
      navy: new THREE.MeshPhysicalMaterial({
        color: NAVY,
        roughness: 0.3,
        metalness: 0.2,
        clearcoat: 1,
        clearcoatRoughness: 0.2,
      }),
      white: new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        roughness: 0.2,
        clearcoat: 1,
      }),
    }),
    [],
  );

  // Lay objects out relative to the visible area so they sit in the hero's
  // empty spaces: top-right corner, the gap left of the phone, and between
  // the buttons and the phone.
  const w = viewport.width;
  const h = viewport.height;

  return (
    <group>
      <Floating
        position={[w / 2 - 0.6, h / 2 - 1, -0.5]}
        baseRotation={[0.25, -0.6, 0.2]}
        speed={0.9}
      >
        <group scale={0.85}>
          <AppIcon blue={materials.blue} white={materials.white} />
        </group>
      </Floating>

      <Floating position={[w * 0.08, -h / 2 + 0.95, 0]} baseRotation={[0.5, 0.3, -0.15]} speed={0.7} spin={0.5}>
        <group scale={0.7}>
          <Smile width={2.4} depth={0.55} radius={0.2} material={materials.blue} />
        </group>
      </Floating>

      <Floating position={[w * 0.08, h / 2 - 1.3, -1.5]} baseRotation={[0.1, 0.5, -0.1]} speed={1.1}>
        <CheckCoin navy={materials.navy} white={materials.white} />
      </Floating>
    </group>
  );
}

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    pmrem.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);
  return null;
}

export default function HeroScene() {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 8], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      frameloop={reducedMotion ? "demand" : "always"}
      // The canvas sits behind the hero with pointer-events off, so track the
      // mouse across the whole page for the parallax instead.
      eventSource={document.body}
      eventPrefix="client"
    >
      <Environment />
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} />
      <directionalLight position={[-5, -2, 3]} intensity={0.5} color="#bcd3ff" />
      <Objects />
    </Canvas>
  );
}
