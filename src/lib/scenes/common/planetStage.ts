// @ts-nocheck
// Shared "strolling planet" scaffolding.
//
// Both the jungle and the metropolis worlds use the same trick as the original
// trippy-90s scene: the walker stays put at the top of a big sphere while the
// sphere rolls underneath them, sweeping placed props over the horizon and past
// the camera. This module owns the boring boilerplate (renderer, camera, bloom,
// the road band, placement math, resize + dispose) so each scene file can focus
// purely on its own art.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createCameraRig } from './cameraRig';

export const TAU = Math.PI * 2;

/** Deterministic hash noise shared with the character's stop-motion clock. */
export function makeRng() {
  return function rnd(i: number, salt: number) {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
}

export type ClearanceVolume = { radius: number; topY: number; baseY?: number };

/**
 * Keeps scene props out of an elevated/airborne character's keep-clear column.
 *
 * Every prop eventually rolls over the lane apex where the character floats, so
 * a prop is safe iff its lateral offset keeps its whole silhouette outside the
 * character's clearance cylinder. Given the lateral distance a scene *wants*, the
 * prop's inward `reach` (how far it extends back toward the lane center at that
 * distance) and the prop's vertical span, this returns the minimum lateral
 * distance that clears the column — or `requested` unchanged when the character
 * declares no clearance, or the prop is entirely above/below the band.
 *
 * All values are world units. Grounded walkers pass `undefined` and nothing moves.
 */
export function clearLateralDistance(
  clearance: ClearanceVolume | undefined,
  requested: number,
  reach: number,
  bottomY: number,
  topY: number
): number {
  if (!clearance) return requested;
  const base = clearance.baseY ?? 0;
  if (topY <= base || bottomY >= clearance.topY) return requested; // no vertical overlap
  return Math.max(requested, clearance.radius + reach);
}

export type PlanetStageOptions = {
  /** Sphere radius. Bigger = flatter, gentler arc across the frame. */
  R?: number;
  /** Walking-path width in world units. */
  roadWidth?: number;
  /** Toon color of the whole globe (the ground off the path). */
  groundColor?: number;
  /** Toon color of the central walking path band. */
  roadColor?: number;
  /** Bloom strength / radius / threshold. */
  bloom?: { strength?: number; radius?: number; threshold?: number };
  /** Forward stroll speed (surface units / second). */
  walkSpeed?: number;
};

export function createPlanetStage(container: HTMLElement, opts: PlanetStageOptions = {}) {
  const R = opts.R ?? 30;
  const roadWidth = opts.roadWidth ?? 6.4;
  const walkSpeed = opts.walkSpeed ?? 1.75;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  // ---------- scene / camera ----------
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a0b33, 42, 120);

  const camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 600);
  camera.position.set(0, 3.4, 7.6);
  camera.lookAt(0, 1.9, -10);
  const cameraRig = createCameraRig(camera);

  // ---------- post ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    opts.bloom?.strength ?? 0.42,
    opts.bloom?.radius ?? 0.34,
    opts.bloom?.threshold ?? 0.92
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  // ---------- lights ----------
  const hemiLight = new THREE.HemisphereLight(0x9080b8, 0x2a1440, 0.9);
  scene.add(hemiLight);
  const sunLight = new THREE.DirectionalLight(0xffe8b0, 0.75);
  sunLight.position.set(0, 18, -40);
  scene.add(sunLight);
  const rim = new THREE.DirectionalLight(0x88a8c0, 0.28);
  rim.position.set(6, 8, 10);
  scene.add(rim);

  // ---------- the rolling planet ----------
  const planet = new THREE.Group();
  planet.position.set(0, -R, 0); // top of the sphere sits at world y = 0
  scene.add(planet);

  const groundMat = new THREE.MeshToonMaterial({ color: opts.groundColor ?? 0x3a5a2a });
  const ground = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 48), groundMat);
  planet.add(ground);

  const roadHalfAng = roadWidth / 2 / R;
  const roadMat = new THREE.MeshToonMaterial({ color: opts.roadColor ?? 0x5a4030, side: THREE.DoubleSide });
  const road = new THREE.Mesh(
    new THREE.SphereGeometry(R + 0.06, 96, 10, 0, TAU, Math.PI / 2 - roadHalfAng, roadHalfAng * 2),
    roadMat
  );
  road.rotation.z = Math.PI / 2; // run the band through the top, under the walker's feet
  planet.add(road);

  // ---------- placement on the sphere ----------
  // a = angle along the path (increases away from the camera, rolls toward you)
  // b = lateral tilt across the path (radians; +/- = left/right of center)
  // h = radial lift above the surface
  const _qa = new THREE.Quaternion();
  const _qb = new THREE.Quaternion();
  const _X = new THREE.Vector3(1, 0, 0);
  const _Z = new THREE.Vector3(0, 0, 1);
  function onPlanet(obj: THREE.Object3D, a: number, b: number, h = 0) {
    const r = R + h;
    obj.position.set(r * Math.sin(b), r * Math.cos(b) * Math.cos(a), r * Math.cos(b) * Math.sin(a));
    _qa.setFromAxisAngle(_X, a);
    _qb.setFromAxisAngle(_Z, -b);
    obj.quaternion.multiplyQuaternions(_qa, _qb);
    planet.add(obj);
    return obj;
  }

  /** Lateral world distance -> tilt angle, for placing props a fixed distance off the path. */
  function lateral(distance: number) {
    return distance / R;
  }

  // ---------- a curved surface patch (paths, water, plazas) ----------
  function addPlanetPatch(a0: number, a1: number, b0: number, b1: number, r: number, mat: THREE.Material, aSeg = 8, bSeg = 8, renderOrder = 1) {
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let ia = 0; ia <= aSeg; ia++) {
      const a = a0 + (a1 - a0) * (ia / aSeg);
      for (let ib = 0; ib <= bSeg; ib++) {
        const b = b0 + (b1 - b0) * (ib / bSeg);
        vertices.push(r * Math.sin(b), r * Math.cos(b) * Math.cos(a), r * Math.cos(b) * Math.sin(a));
      }
    }
    const row = bSeg + 1;
    for (let ia = 0; ia < aSeg; ia++) {
      for (let ib = 0; ib < bSeg; ib++) {
        const p = ia * row + ib;
        indices.push(p, p + row, p + 1, p + 1, p + row, p + row + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = renderOrder;
    planet.add(mesh);
    return mesh;
  }

  // ---------- resize ----------
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  // ---------- orientation: forward roll + optional heading turns ----------
  // Forward motion is always a roll about the WORLD X axis (the walker + camera
  // are world-fixed, so "forward" is always -Z). A turn is a roll about the
  // WORLD Y axis (vertical, through the walker at the top of the sphere). Both
  // are applied by *pre*-multiplying the planet quaternion, so they compose in
  // the order they happen in time: after a 90° heading turn, continued forward
  // roll automatically tracks the perpendicular cross-street great circle.
  const _WORLD_X = new THREE.Vector3(1, 0, 0);
  const _WORLD_Y = new THREE.Vector3(0, 1, 0);
  const _qRoll = new THREE.Quaternion();
  const _qTurn = new THREE.Quaternion();
  let rollTotal = 0; // accumulated forward roll in radians (surface dist / R)

  /** Pivot the world about the vertical through the walker (corner turn). */
  function turnBy(angle: number) {
    if (!angle) return;
    _qTurn.setFromAxisAngle(_WORLD_Y, angle);
    planet.quaternion.premultiply(_qTurn);
  }

  // ---------- loop + dispose ----------
  let rafId = 0;
  let disposed = false;
  let last = performance.now() / 1000;

  /**
   * Drives the render loop. The callback receives wall-clock seconds and the
   * frame delta; the forward roll + composer render are handled here. The
   * callback may call turnBy() to steer.
   */
  function run(onFrame: (t: number, dt: number) => void) {
    function frame() {
      if (disposed) return;
      const now = performance.now() / 1000;
      const dt = Math.min(now - last, 0.05);
      last = now;
      if (!reduceMotion) {
        const dRoll = (walkSpeed / R) * dt;
        _qRoll.setFromAxisAngle(_WORLD_X, dRoll);
        planet.quaternion.premultiply(_qRoll);
        rollTotal += dRoll;
      }
      onFrame(now, dt);
      composer.render();
      if (!disposed) rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
  }

  function dispose(extra?: () => void) {
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    extra?.();
    composer.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
  }

  return {
    renderer,
    scene,
    camera,
    cameraRig,
    composer,
    bloomPass,
    hemiLight,
    sunLight,
    rim,
    planet,
    ground,
    groundMat,
    road,
    roadMat,
    R,
    roadHalfAng,
    reduceMotion,
    onPlanet,
    lateral,
    addPlanetPatch,
    run,
    turnBy,
    dispose,
    get rollTotal() {
      return rollTotal;
    }
  };
}
