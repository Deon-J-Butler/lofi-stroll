// @ts-nocheck
// Jungle stroll.
//
// A dirt path winds straight down a rolling jungle floor. Frayed grass crowds
// the edges, oversized jungle trees and hanging vines drift past, and the sky
// toggles between a hot orange/yellow/red daytime and a deep blue/purple night
// full of stars, drifting celestial bursts, and a couple of slowly flashing red
// eyes hiding in the undergrowth.

import * as THREE from 'three';
import { createPlanetStage, makeRng, TAU, clearLateralDistance } from './common/planetStage';
import { createCharacter } from '../characters';
import type { CharacterDefinition, SceneDefinition } from '../registry/types';

export type JungleSceneOptions = {
  scene: SceneDefinition;
  character: CharacterDefinition;
};

export function createJungleScene(container: HTMLElement, options: JungleSceneOptions) {
  const rnd = makeRng();

  const stage = createPlanetStage(container, {
    R: 30,
    roadWidth: 5.6,
    groundColor: 0x2f4222, // mossy jungle floor
    roadColor: 0x6b4a2e, // mid dirt brown
    walkSpeed: 1.7 * (options.character.speedScale ?? 1),
    bloom: { strength: 0.5, radius: 0.4, threshold: 0.86 }
  });

  const { scene, camera, cameraRig, planet, R, roadHalfAng, onPlanet, lateral, addPlanetPatch, hemiLight, sunLight, rim, bloomPass } = stage;

  let moonOn = false;
  let gradientOn = false;

  // ===================================================================
  //  SKY — full-screen gradient canvas, repainted with a slow breath
  // ===================================================================
  const skyCv = document.createElement('canvas');
  skyCv.width = 8;
  skyCv.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCv);
  skyTex.magFilter = THREE.LinearFilter;
  skyTex.minFilter = THREE.LinearFilter;
  scene.background = skyTex;

  function paintSky(t: number) {
    const g = skyCv.getContext('2d')!;
    const breathe = Math.sin(t * 0.05) * 0.5 + 0.5;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    if (moonOn) {
      // deep blue zenith -> violet -> dusky purple horizon
      grad.addColorStop(0.0, `hsl(${232 + breathe * 6}, 62%, 9%)`);
      grad.addColorStop(0.4, `hsl(${250 + breathe * 6}, 55%, 16%)`);
      grad.addColorStop(0.72, `hsl(${272 + breathe * 6}, 48%, 24%)`);
      grad.addColorStop(1.0, `hsl(${288 + breathe * 6}, 42%, 30%)`);
    } else {
      // smouldering red zenith -> orange -> hot yellow horizon
      grad.addColorStop(0.0, `hsl(${356 + breathe * 4}, 72%, 32%)`);
      grad.addColorStop(0.34, `hsl(${12 + breathe * 5}, 85%, 46%)`);
      grad.addColorStop(0.64, `hsl(${30 + breathe * 5}, 92%, 56%)`);
      grad.addColorStop(0.86, `hsl(${44 + breathe * 4}, 96%, 62%)`);
      grad.addColorStop(1.0, `hsl(${52 + breathe * 4}, 98%, 70%)`);
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 256);
    skyTex.needsUpdate = true;
  }

  // ===================================================================
  //  SUN — warm disc by day, pale moon by night
  // ===================================================================
  const sunCv = document.createElement('canvas');
  sunCv.width = 256;
  sunCv.height = 256;
  const sunTex = new THREE.CanvasTexture(sunCv);
  const sunMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(58, 58),
    new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false })
  );
  sunMesh.position.set(7, 17, -120);
  sunMesh.renderOrder = -1;
  scene.add(sunMesh);

  function paintSun() {
    const g = sunCv.getContext('2d')!;
    g.clearRect(0, 0, 256, 256);
    if (moonOn) {
      const glow = g.createRadialGradient(128, 128, 30, 128, 128, 128);
      glow.addColorStop(0, 'rgba(206, 210, 224, 0.5)');
      glow.addColorStop(0.5, 'rgba(150, 160, 200, 0.18)');
      glow.addColorStop(1, 'rgba(80, 90, 140, 0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, 256, 256);
      g.save();
      g.beginPath();
      g.arc(128, 122, 70, 0, TAU);
      g.clip();
      const base = g.createRadialGradient(104, 96, 8, 128, 122, 84);
      base.addColorStop(0, 'rgb(226, 230, 240)');
      base.addColorStop(1, 'rgb(150, 162, 196)');
      g.fillStyle = base;
      g.fillRect(40, 40, 176, 176);
      g.restore();
    } else {
      const corona = g.createRadialGradient(128, 128, 36, 128, 128, 128);
      corona.addColorStop(0, 'hsla(48, 100%, 78%, 0.9)');
      corona.addColorStop(0.45, 'hsla(36, 100%, 60%, 0.4)');
      corona.addColorStop(1, 'hsla(24, 100%, 52%, 0)');
      g.fillStyle = corona;
      g.fillRect(0, 0, 256, 256);
      const disc = g.createRadialGradient(120, 118, 12, 128, 128, 88);
      disc.addColorStop(0, 'hsl(52, 100%, 82%)');
      disc.addColorStop(0.6, 'hsl(44, 100%, 66%)');
      disc.addColorStop(1, 'hsl(34, 96%, 56%)');
      g.beginPath();
      g.arc(128, 128, 84, 0, TAU);
      g.fillStyle = disc;
      g.fill();
    }
    sunTex.needsUpdate = true;
  }

  // ===================================================================
  //  STARFIELD + CELESTIAL BURSTS (night only)
  // ===================================================================
  const nightSky = new THREE.Group();
  nightSky.visible = false;
  scene.add(nightSky);

  // twinkling stars on a far dome
  const starCount = 520;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starPhase: number[] = [];
  for (let i = 0; i < starCount; i++) {
    // upper hemisphere shell in front of / above the walker
    const az = (rnd(i, 1) - 0.5) * Math.PI * 1.6;
    const el = rnd(i, 2) * Math.PI * 0.46 + 0.04;
    const rad = 230 + rnd(i, 3) * 60;
    starPos[i * 3] = Math.sin(az) * Math.cos(el) * rad;
    starPos[i * 3 + 1] = Math.sin(el) * rad + 4;
    starPos[i * 3 + 2] = -Math.cos(az) * Math.cos(el) * rad;
    starPhase.push(rnd(i, 4) * TAU);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    size: 1.5,
    sizeAttenuation: true,
    color: 0xeaf0ff,
    transparent: true,
    opacity: 0.9,
    fog: false,
    depthWrite: false
  });
  const stars = new THREE.Points(starGeo, starMat);
  nightSky.add(stars);

  // celestial bursts — soft nebula glows littered across the whole night sky in
  // green / teal / blue / purple, every size. Only revealed with the RGB toggle,
  // and kept sparse enough that the star field still reads as the main event.
  const burstField = new THREE.Group();
  burstField.visible = false;
  nightSky.add(burstField);

  // one shared radial-glow texture, tinted per-sprite via material.color
  const burstCv = document.createElement('canvas');
  burstCv.width = 128;
  burstCv.height = 128;
  {
    const g = burstCv.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 3, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.45)');
    grd.addColorStop(0.65, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const burstTex = new THREE.CanvasTexture(burstCv);
  const burstHues = [148, 176, 210, 285]; // green, teal, blue, purple
  const bursts: { spr: THREE.Sprite; phase: number; baseS: number; baseOp: number }[] = [];
  for (let i = 0; i < 22; i++) {
    const hue = burstHues[Math.floor(rnd(i, 6) * burstHues.length)];
    const mat = new THREE.SpriteMaterial({
      map: burstTex,
      color: new THREE.Color().setHSL(hue / 360, 0.85, 0.62),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending
    });
    const spr = new THREE.Sprite(mat);
    // spread across the upper hemisphere all around the view
    const az = (rnd(i, 7) - 0.5) * Math.PI * 1.9;
    const el = 0.1 + rnd(i, 8) * Math.PI * 0.42;
    const rad = 185 + rnd(i, 10) * 90;
    spr.position.set(Math.sin(az) * Math.cos(el) * rad, Math.sin(el) * rad + 8, -Math.cos(az) * Math.cos(el) * rad);
    const s = 16 + rnd(i, 11) * 120; // every size, from faint pinpricks to big clouds
    spr.scale.set(s, s, 1);
    burstField.add(spr);
    bursts.push({ spr, phase: rnd(i, 9) * TAU, baseS: s, baseOp: 0.32 + rnd(i, 12) * 0.4 });
  }

  // ===================================================================
  //  GROUND DRESSING — dirt mottling + frayed grass along the path
  // ===================================================================
  // darker brown blotches scattered along the dirt path for shade variation
  const dirtMat = new THREE.MeshToonMaterial({ color: 0x5a3a22, side: THREE.DoubleSide });
  const dirtMatDark = new THREE.MeshToonMaterial({ color: 0x47301d, side: THREE.DoubleSide });
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * TAU + (rnd(i, 11) - 0.5) * 0.04;
    const b = (rnd(i, 12) - 0.5) * roadHalfAng * 1.5;
    const wA = (0.18 + rnd(i, 13) * 0.4) / R;
    const wB = (0.18 + rnd(i, 14) * 0.4) / R;
    addPlanetPatch(a - wA, a + wA, b - wB, b + wB, R + 0.07, rnd(i, 15) > 0.5 ? dirtMat : dirtMatDark, 2, 2, 2);
  }

  // frayed grass tufts — thin bent blades clustered on both shoulders
  const bladeGeo = new THREE.ConeGeometry(0.045, 0.6, 4, 1, true);
  bladeGeo.translate(0, 0.3, 0); // pivot at base
  const grassMats = [
    new THREE.MeshToonMaterial({ color: 0x3c6b27, side: THREE.DoubleSide }),
    new THREE.MeshToonMaterial({ color: 0x4f8a2e, side: THREE.DoubleSide }),
    new THREE.MeshToonMaterial({ color: 0x6f9b2c, side: THREE.DoubleSide }),
    new THREE.MeshToonMaterial({ color: 0x8a7d22, side: THREE.DoubleSide }) // dry/frayed
  ];
  function makeGrassTuft(seed: number) {
    const tuft = new THREE.Group();
    const n = 4 + Math.floor(rnd(seed, 21) * 3);
    for (let k = 0; k < n; k++) {
      const blade = new THREE.Mesh(bladeGeo, grassMats[Math.floor(rnd(seed + k, 22) * grassMats.length)]);
      const h = 0.6 + rnd(seed + k, 23) * 0.9;
      blade.scale.set(0.8 + rnd(seed + k, 24) * 0.6, h, 0.8);
      blade.position.set((rnd(seed + k, 25) - 0.5) * 0.42, 0, (rnd(seed + k, 26) - 0.5) * 0.42);
      // bend the blade outward so the tuft looks frayed, not a neat brush
      blade.rotation.z = (rnd(seed + k, 27) - 0.5) * 0.9;
      blade.rotation.x = (rnd(seed + k, 28) - 0.5) * 0.6;
      tuft.add(blade);
    }
    return tuft;
  }

  const grassTufts: { grp: THREE.Group; sway: number; phase: number }[] = [];
  for (let i = 0; i < 130; i++) {
    const a = (i / 130) * TAU + (rnd(i, 31) - 0.5) * 0.03;
    const side = i % 2 === 0 ? 1 : -1;
    const edge = roadHalfAng + lateral(0.2 + rnd(i, 32) * 1.6);
    const tuft = makeGrassTuft(i * 7 + 3);
    onPlanet(tuft, a, side * edge, 0.05);
    grassTufts.push({ grp: tuft, sway: 0.04 + rnd(i, 33) * 0.05, phase: rnd(i, 34) * TAU });
  }

  // ===================================================================
  //  JUNGLE TREES — a few exaggerated species, with hanging vines
  // ===================================================================
  const trunkMat = new THREE.MeshToonMaterial({ color: 0x4a3322 });
  const trunkMatLight = new THREE.MeshToonMaterial({ color: 0x5e4530 });
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x10180a, side: THREE.BackSide });
  const vineMat = new THREE.MeshToonMaterial({ color: 0x355c24 });
  const leafMats = [
    new THREE.MeshToonMaterial({ color: 0x2f6b2a }),
    new THREE.MeshToonMaterial({ color: 0x3f8331 }),
    new THREE.MeshToonMaterial({ color: 0x57993a }),
    new THREE.MeshToonMaterial({ color: 0x6f8f2e })
  ];
  // near-black foliage for the deep, dense thickets
  const darkLeafMats = [
    new THREE.MeshToonMaterial({ color: 0x0c1808 }),
    new THREE.MeshToonMaterial({ color: 0x101f0b }),
    new THREE.MeshToonMaterial({ color: 0x0a1406 }),
    new THREE.MeshToonMaterial({ color: 0x152a0f })
  ];
  // builders read this; swapped to darkLeafMats while filling a thicket
  let pal = leafMats;

  // Dense, almost-black thickets at a few points around the ring. Trees pile up
  // here and the red eyes only ever appear inside them at night.
  const thickets = [
    { a: 0.9, halfSpan: 0.34 },
    { a: 2.7, halfSpan: 0.30 },
    { a: 4.2, halfSpan: 0.40 },
    { a: 5.6, halfSpan: 0.32 }
  ];

  function addOutline(mesh: THREE.Mesh, s = 1.08) {
    const hull = new THREE.Mesh(mesh.geometry, outlineMat);
    hull.scale.setScalar(s);
    mesh.add(hull);
    return hull;
  }

  // a curving hanging vine built from a thin tube along a wavy curve
  function makeVine(seed: number, length: number) {
    const pts: THREE.Vector3[] = [];
    const segs = 8;
    const drift = (rnd(seed, 41) - 0.5) * 1.2;
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      pts.push(new THREE.Vector3(Math.sin(f * 3 + seed) * 0.25 * f + drift * f, -f * length, Math.cos(f * 2.5 + seed) * 0.2 * f));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.05, 5, false), vineMat);
    const grp = new THREE.Group();
    grp.add(tube);
    // a few leaf nubs along the vine
    for (let i = 1; i < segs; i += 2) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), pal[i % pal.length]);
      const p = curve.getPoint(i / segs);
      leaf.position.copy(p);
      leaf.scale.set(1.4, 0.5, 1);
      grp.add(leaf);
    }
    return grp;
  }

  function addVines(canopy: THREE.Object3D, seed: number, count: number, radius: number, dropY: number) {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * TAU + rnd(seed + i, 42);
      const vine = makeVine(seed * 3 + i, 1.4 + rnd(seed + i, 43) * 2.2);
      vine.position.set(Math.cos(ang) * radius, dropY, Math.sin(ang) * radius);
      canopy.add(vine);
    }
  }

  // SPECIES 1 — giant emergent: tall buttressed trunk, stacked round canopy, lots of vines
  function makeEmergentTree(seed: number) {
    const grp = new THREE.Group();
    const h = 7 + rnd(seed, 51) * 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, h, 8), trunkMat);
    trunk.position.y = h / 2;
    addOutline(trunk, 1.12);
    grp.add(trunk);
    // root buttresses
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * TAU + 0.4;
      const root = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 5), trunkMatLight);
      root.position.set(Math.cos(ang) * 0.5, 0.6, Math.sin(ang) * 0.5);
      root.rotation.z = Math.cos(ang) * 0.5;
      root.rotation.x = -Math.sin(ang) * 0.5;
      grp.add(root);
    }
    // stacked rounded canopy
    const canopy = new THREE.Group();
    canopy.position.y = h;
    const blobs = 5 + Math.floor(rnd(seed, 52) * 3);
    for (let i = 0; i < blobs; i++) {
      const lm = pal[Math.floor(rnd(seed + i, 53) * pal.length)];
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 + rnd(seed + i, 54) * 1.0, 1), lm);
      blob.position.set((rnd(seed + i, 55) - 0.5) * 3.2, rnd(seed + i, 56) * 1.8, (rnd(seed + i, 57) - 0.5) * 3.2);
      blob.scale.set(1.1, 0.85, 1.1);
      addOutline(blob, 1.06);
      canopy.add(blob);
    }
    addVines(canopy, seed, 6, 1.9, -0.4);
    grp.add(canopy);
    return { grp, canopy };
  }

  // SPECIES 2 — palm: curved segmented trunk crowned with radiating fronds
  function makePalmTree(seed: number) {
    const grp = new THREE.Group();
    const segs = 6;
    const segH = 1.1;
    let prev = new THREE.Group();
    grp.add(prev);
    const lean = (rnd(seed, 61) - 0.5) * 0.8;
    for (let i = 0; i < segs; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, segH, 7), trunkMatLight);
      seg.position.y = segH / 2;
      prev.add(seg);
      const next = new THREE.Group();
      next.position.y = segH;
      next.rotation.z = lean / segs;
      seg.parent.add(next);
      prev = next;
    }
    // fronds
    const crown = prev;
    const frondGeo = new THREE.ConeGeometry(0.5, 3.2, 4, 1, false);
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * TAU;
      const frond = new THREE.Mesh(frondGeo, pal[i % pal.length]);
      frond.position.set(Math.cos(ang) * 1.3, 0.2, Math.sin(ang) * 1.3);
      frond.scale.set(0.5, 1, 1.6);
      frond.rotation.z = Math.cos(ang) * 1.1 - Math.PI / 2 + Math.PI / 2;
      frond.rotation.order = 'ZYX';
      frond.rotation.y = -ang;
      frond.rotation.x = 1.15;
      crown.add(frond);
    }
    const cocos = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), pal[1]);
    cocos.scale.set(1, 0.7, 1);
    crown.add(cocos);
    return { grp, canopy: crown };
  }

  // SPECIES 3 — broad umbrella tree: leaning trunk, wide flat canopy, dangling vines
  function makeUmbrellaTree(seed: number) {
    const grp = new THREE.Group();
    const h = 4.5 + rnd(seed, 71) * 2.5;
    const lean = (rnd(seed, 72) - 0.5) * 0.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, h, 7), trunkMat);
    trunk.position.y = h / 2;
    trunk.rotation.z = lean;
    addOutline(trunk, 1.12);
    grp.add(trunk);
    const canopy = new THREE.Group();
    canopy.position.set(Math.sin(lean) * h, h, 0);
    const disc = new THREE.Mesh(new THREE.SphereGeometry(3.4, 12, 8), pal[Math.floor(rnd(seed, 73) * pal.length)]);
    disc.scale.set(1.2, 0.4, 1.2);
    addOutline(disc, 1.05);
    canopy.add(disc);
    const disc2 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 7), pal[(seed + 1) % pal.length]);
    disc2.position.y = 0.7;
    disc2.scale.set(1.1, 0.5, 1.1);
    addOutline(disc2, 1.05);
    canopy.add(disc2);
    addVines(canopy, seed + 5, 7, 2.6, -0.2);
    grp.add(canopy);
    return { grp, canopy };
  }

  // SPECIES 4 — fern cluster: low spray of fronds, fills the understory
  function makeFernCluster(seed: number) {
    const grp = new THREE.Group();
    const frondGeo = new THREE.ConeGeometry(0.35, 2.0, 4);
    const n = 6 + Math.floor(rnd(seed, 81) * 4);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + rnd(seed + i, 82);
      const frond = new THREE.Mesh(frondGeo, pal[i % pal.length]);
      frond.scale.set(0.4, 1, 1);
      const tilt = 0.6 + rnd(seed + i, 83) * 0.5;
      frond.position.set(Math.cos(ang) * 0.6, 0.9, Math.sin(ang) * 0.6);
      frond.rotation.order = 'ZYX';
      frond.rotation.y = -ang;
      frond.rotation.x = tilt;
      grp.add(frond);
    }
    return { grp, canopy: grp };
  }

  const trees: { grp: THREE.Group; sway: number; phase: number; baseRot: number }[] = [];
  let treeSeed = 100;

  function pickBuilder(r: number) {
    if (r < 0.32) return { build: makeEmergentTree, dist: 4.5 + r * 22 };
    if (r < 0.52) return { build: makePalmTree, dist: 3.5 + r * 20 };
    if (r < 0.74) return { build: makeUmbrellaTree, dist: 3.2 + r * 18 };
    return { build: makeFernCluster, dist: roadHalfAng * R + 0.4 + r * 6 };
  }

  // ---- keep an airborne character's flight corridor clear of trees ----
  // If the active character declares a clearance column (e.g. the flying hero),
  // push any tree that would intrude it outward. A tall tree only passes its thin
  // trunk through the hero's band — its wide canopy clears overhead — so we cap its
  // inward reach; a short tree puts its whole footprint in the band.
  const clearance = options.character.clearance;
  const _treeBox = new THREE.Box3();
  const TRUNK_REACH = 1.6;
  function clearTreeDist(grp, requested) {
    if (!clearance) return requested;
    grp.updateMatrixWorld(true);
    _treeBox.setFromObject(grp);
    const topY = _treeBox.max.y;
    const reachFull = Math.max(Math.abs(_treeBox.min.x), _treeBox.max.x, Math.abs(_treeBox.min.z), _treeBox.max.z);
    const reach = topY > clearance.topY + 1.5 ? Math.min(reachFull, TRUNK_REACH) : reachFull;
    return clearLateralDistance(clearance, requested, reach, _treeBox.min.y, topY);
  }

  // ---- nature doesn't space things out: a deep, overlapping carpet of trees ----
  for (let i = 0; i < 240; i++) {
    const a = rnd(i, 90) * TAU;
    const side = rnd(i, 92) > 0.5 ? 1 : -1;
    const { build, dist } = pickBuilder(rnd(i, 93));
    pal = leafMats;
    const { grp, canopy } = build(treeSeed++);
    const sc = 0.8 + rnd(i, 98) * 0.8;
    grp.scale.setScalar(sc);
    onPlanet(grp, a, side * lateral(clearTreeDist(grp, dist)), 0);
    grp.rotateY(rnd(i, 99) * TAU);
    trees.push({ grp: canopy, sway: 0.02 + rnd(i, 100) * 0.03, phase: rnd(i, 101) * TAU, baseRot: canopy.rotation.z });
  }

  // ---- dense black thickets: packed dark trees crowding both sides of the path ----
  // a blackish floor patch sells the "no light gets in here" feel
  const thicketFloorMat = new THREE.MeshToonMaterial({ color: 0x0a1206, side: THREE.DoubleSide });
  for (let ti = 0; ti < thickets.length; ti++) {
    const th = thickets[ti];
    addPlanetPatch(th.a - th.halfSpan, th.a + th.halfSpan, -lateral(16), lateral(16), R + 0.04, thicketFloorMat, 6, 8, 1);
    const count = 46;
    for (let j = 0; j < count; j++) {
      const seed = 5000 + ti * 200 + j;
      const a = th.a + (rnd(seed, 1) - 0.5) * 2 * th.halfSpan;
      const side = rnd(seed, 2) > 0.5 ? 1 : -1;
      pal = darkLeafMats;
      // crowd them in close to the path and overlapping, big and looming
      const r = rnd(seed, 3);
      const { build } = pickBuilder(r * 0.74); // skew toward big canopy species
      const { grp, canopy } = build(treeSeed++);
      const sc = 1.0 + rnd(seed, 4) * 0.9;
      grp.scale.setScalar(sc);
      const dist = roadHalfAng * R + 0.6 + rnd(seed, 5) * 9;
      onPlanet(grp, a, side * lateral(clearTreeDist(grp, dist)), 0);
      grp.rotateY(rnd(seed, 6) * TAU);
      trees.push({ grp: canopy, sway: 0.015 + rnd(seed, 7) * 0.025, phase: rnd(seed, 8) * TAU, baseRot: canopy.rotation.z });
    }
  }
  pal = leafMats;

  // ===================================================================
  //  RED EYES — pairs of slowly flashing eyes hidden in the foliage (night)
  // ===================================================================
  function makeEyeTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 1, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,240,210,1)');
    grd.addColorStop(0.25, 'rgba(255,70,40,1)');
    grd.addColorStop(0.6, 'rgba(180,10,0,0.6)');
    grd.addColorStop(1, 'rgba(120,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const eyeTex = makeEyeTexture();
  const eyePairs: { grp: THREE.Group; mats: THREE.SpriteMaterial[]; phase: number; rate: number }[] = [];
  // one or two pairs lurking deep in each black thicket — and nowhere else
  let eyeSeed = 600;
  for (let ti = 0; ti < thickets.length; ti++) {
    const th = thickets[ti];
    const pairs = 1 + (rnd(ti, 120) > 0.5 ? 1 : 0);
    for (let p = 0; p < pairs; p++) {
      const seed = eyeSeed++;
      const grp = new THREE.Group();
      const mats: THREE.SpriteMaterial[] = [];
      for (let e = 0; e < 2; e++) {
        const mat = new THREE.SpriteMaterial({
          map: eyeTex,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          fog: false,
          blending: THREE.AdditiveBlending
        });
        const spr = new THREE.Sprite(mat);
        spr.scale.set(0.34, 0.22, 1);
        spr.position.set(e === 0 ? -0.28 : 0.28, 1.3 + rnd(seed, 110) * 1.8, 0);
        spr.renderOrder = 40;
        grp.add(spr);
        mats.push(mat);
      }
      const a = th.a + (rnd(seed, 113) - 0.5) * 2 * th.halfSpan * 0.7;
      const side = rnd(seed, 114) > 0.5 ? 1 : -1;
      const dist = roadHalfAng * R + 1.2 + rnd(seed, 115) * 6;
      onPlanet(grp, a, side * lateral(dist), 0);
      eyePairs.push({ grp, mats, phase: rnd(seed, 111) * TAU, rate: 0.22 + rnd(seed, 112) * 0.3 });
    }
  }

  // ===================================================================
  //  CHARACTER
  // ===================================================================
  const character = createCharacter(options.character, rnd);
  scene.add(character.group);

  // ===================================================================
  //  ANIMATION
  // ===================================================================
  const CHAR_FPS = 30;
  let lastFrameIdx = -1;

  stage.run((t, dt) => {
    paintSky(t);
    paintSun();

    // day / night swap: sky body position, lighting, fog, nebula visibility
    if (moonOn) {
      sunMesh.position.set(8, 19, -120);
      nightSky.visible = true;
      scene.fog.color.setHSL(0.7, 0.4, 0.1);
      scene.fog.near = 30;
      scene.fog.far = 116;
      hemiLight.color.setHSL(0.66, 0.4, 0.26);
      hemiLight.groundColor.setHSL(0.72, 0.5, 0.06);
      hemiLight.intensity = 0.62;
      sunLight.color.setHSL(0.62, 0.3, 0.6);
      sunLight.intensity = 0.3;
      sunLight.position.set(8, 19, -40);
      rim.color.setHSL(0.74, 0.4, 0.5);
      rim.intensity = 0.3;
      bloomPass.strength = 0.62;
      bloomPass.threshold = 0.78;

      // stars twinkle
      starMat.opacity = 0.7 + 0.3 * Math.sin(t * 0.8);
      stars.rotation.y = t * 0.004;
      // celestial bursts only appear with the RGB toggle on
      burstField.visible = gradientOn;
      if (gradientOn) {
        for (const b of bursts) {
          b.spr.material.opacity = b.baseOp * (0.7 + 0.3 * Math.sin(t * 0.18 + b.phase));
          const s = b.baseS * (1 + 0.06 * Math.sin(t * 0.12 + b.phase));
          b.spr.scale.set(s, s, 1);
        }
      }
      // red eyes: slow flash, with the occasional slow blink
      for (const ep of eyePairs) {
        const base = 0.5 + 0.5 * Math.sin(t * ep.rate + ep.phase);
        const blink = Math.sin(t * 0.5 + ep.phase) > 0.96 ? 0 : 1; // brief blink
        const v = Math.pow(base, 1.6) * blink;
        ep.mats[0].opacity = v;
        ep.mats[1].opacity = v;
      }
    } else {
      sunMesh.position.set(7, 17, -120);
      nightSky.visible = false;
      scene.fog.color.setHSL(0.06, 0.7, 0.4);
      scene.fog.near = 36;
      scene.fog.far = 130;
      hemiLight.color.setHSL(0.09, 0.7, 0.62);
      hemiLight.groundColor.setHSL(0.1, 0.6, 0.22);
      hemiLight.intensity = 1.0;
      sunLight.color.setHSL(0.09, 0.85, 0.62);
      sunLight.intensity = 0.95;
      sunLight.position.set(7, 17, -40);
      rim.color.setHSL(0.02, 0.8, 0.55);
      rim.intensity = 0.45;
      bloomPass.strength = 0.5;
      bloomPass.threshold = 0.86;
      for (const ep of eyePairs) {
        ep.mats[0].opacity = 0;
        ep.mats[1].opacity = 0;
      }
    }

    // gentle wind sway on canopies + grass
    if (!stage.reduceMotion) {
      for (const tr of trees) {
        tr.grp.rotation.z = tr.baseRot + Math.sin(t * 0.7 + tr.phase) * tr.sway;
      }
      for (const gt of grassTufts) {
        gt.grp.rotation.z = Math.sin(t * 1.3 + gt.phase) * gt.sway;
      }
    }

    // character stop-motion clock
    if (!stage.reduceMotion) {
      const frameIdx = Math.floor(t * CHAR_FPS);
      if (frameIdx !== lastFrameIdx) {
        lastFrameIdx = frameIdx;
        character.update(frameIdx / CHAR_FPS, frameIdx);
      }
    } else {
      character.update(0, 0);
    }

    cameraRig.apply(stage.reduceMotion ? 0 : Math.sin(t * 0.9) * 1.4);
  });

  return {
    renderer: stage.renderer,
    scene,
    camera,
    setGradient(on: boolean) {
      gradientOn = on;
      character.setGradient?.(on);
    },
    setMoon(on: boolean) {
      moonOn = on;
    },
    setView(mode: 'default' | 'side') {
      cameraRig.setView(mode);
    },
    destroy() {
      stage.dispose(() => character.destroy());
    }
  };
}
