// @ts-nocheck
// Metropolis stroll — MetroCity, after the Megamind skyline.
//
// A busy modern downtown on a deliberately huge globe (so the horizon curve
// stays hidden): a wide avenue runs straight ahead, crossed by 4-way
// intersections with zebra crosswalks, and packed on every side with hundreds of
// towers — plain slabs, art-deco setbacks, glass high-rises — plus a handful of
// identifiable landmarks (Space Needle, Statue of Liberty, a Transamerica
// pyramid, a Capitol dome, a Ferris wheel). Fluffy clouds drift under a yellow
// sun; the night toggle drops a deep blue sky and lights every window.
//
// Corner turns: as the walker reaches an intersection the whole world can pivot
// 90° about the vertical, steering onto the perpendicular cross-street. See the
// note by ENABLE_TURNS for why this is a single clean turn rather than a grid.

import * as THREE from 'three';
import { createPlanetStage, makeRng, TAU } from './common/planetStage';
import { createCharacter } from '../characters';
import type { CharacterDefinition, SceneDefinition } from '../registry/types';

export type MetropolisSceneOptions = {
  scene: SceneDefinition;
  character: CharacterDefinition;
};

export function createMetropolisScene(container: HTMLElement, options: MetropolisSceneOptions) {
  const rnd = makeRng();

  // Big globe → flat horizon, hidden curve, room for a sprawling city.
  const R = 78;
  const ROAD_WIDTH = 7.5;
  const stage = createPlanetStage(container, {
    R,
    roadWidth: ROAD_WIDTH,
    groundColor: 0x8d949c, // pale concrete plaza
    roadColor: 0x33363c, // asphalt
    walkSpeed: 2.0 * (options.character.speedScale ?? 1),
    bloom: { strength: 0.45, radius: 0.42, threshold: 0.84 }
  });

  const { scene, camera, cameraRig, planet, roadHalfAng, onPlanet, lateral, addPlanetPatch, hemiLight, sunLight, rim, bloomPass } = stage;

  let moonOn = false;
  let gradientOn = false;

  // city geometry
  const CITY_HALF = 62; // lateral world half-width filled with buildings
  const CROSS_W = 7.0; // cross-street width
  const N_CROSS = 16; // 4-way intersections around the ring
  const CROSS_ANG = TAU / N_CROSS; // angular spacing between intersections
  const crossHalfAng = CROSS_W / 2 / R;
  const bMax = CITY_HALF / R;

  const litMats: THREE.MeshToonMaterial[] = [];

  // ===================================================================
  //  SKY + SUN
  // ===================================================================
  const skyCv = document.createElement('canvas');
  skyCv.width = 8;
  skyCv.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCv);
  skyTex.magFilter = THREE.LinearFilter;
  skyTex.minFilter = THREE.LinearFilter;
  scene.background = skyTex;

  function paintSky() {
    const g = skyCv.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    if (moonOn) {
      grad.addColorStop(0.0, 'hsl(224, 64%, 8%)');
      grad.addColorStop(0.45, 'hsl(220, 58%, 16%)');
      grad.addColorStop(0.78, 'hsl(214, 50%, 26%)');
      grad.addColorStop(1.0, 'hsl(210, 44%, 34%)');
    } else {
      grad.addColorStop(0.0, 'hsl(208, 80%, 50%)');
      grad.addColorStop(0.45, 'hsl(202, 82%, 61%)');
      grad.addColorStop(0.78, 'hsl(198, 86%, 73%)');
      grad.addColorStop(1.0, 'hsl(194, 92%, 86%)');
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 256);
    skyTex.needsUpdate = true;
  }

  const sunCv = document.createElement('canvas');
  sunCv.width = 256;
  sunCv.height = 256;
  const sunTex = new THREE.CanvasTexture(sunCv);
  const sunMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 46),
    new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false })
  );
  sunMesh.position.set(-16, 30, -175);
  sunMesh.renderOrder = -1;
  scene.add(sunMesh);

  function paintSun() {
    const g = sunCv.getContext('2d')!;
    g.clearRect(0, 0, 256, 256);
    if (moonOn) {
      const glow = g.createRadialGradient(128, 128, 28, 128, 128, 128);
      glow.addColorStop(0, 'rgba(220, 226, 240, 0.5)');
      glow.addColorStop(0.5, 'rgba(170, 184, 220, 0.16)');
      glow.addColorStop(1, 'rgba(90, 110, 160, 0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, 256, 256);
      g.beginPath();
      g.arc(128, 128, 58, 0, TAU);
      g.fillStyle = 'rgb(228, 232, 244)';
      g.fill();
    } else {
      const corona = g.createRadialGradient(128, 128, 40, 128, 128, 128);
      corona.addColorStop(0, 'hsla(52, 100%, 76%, 0.85)');
      corona.addColorStop(0.5, 'hsla(48, 100%, 62%, 0.32)');
      corona.addColorStop(1, 'hsla(46, 100%, 58%, 0)');
      g.fillStyle = corona;
      g.fillRect(0, 0, 256, 256);
      const disc = g.createRadialGradient(120, 120, 14, 128, 128, 78);
      disc.addColorStop(0, 'hsl(56, 100%, 82%)');
      disc.addColorStop(0.7, 'hsl(50, 100%, 66%)');
      disc.addColorStop(1, 'hsl(44, 100%, 58%)');
      g.beginPath();
      g.arc(128, 128, 76, 0, TAU);
      g.fillStyle = disc;
      g.fill();
    }
    sunTex.needsUpdate = true;
  }

  // ===================================================================
  //  FLUFFY CLOUDS
  // ===================================================================
  const cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff });
  const clouds: { grp: THREE.Group; speed: number }[] = [];
  for (let i = 0; i < 11; i++) {
    const grp = new THREE.Group();
    const puffs = 4 + Math.floor(rnd(i, 1) * 4);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), cloudMat);
      const s = 2.2 + rnd(i * 10 + p, 2) * 3.2;
      puff.scale.set(s * 1.4, s * 0.9, s);
      puff.position.set((rnd(i * 10 + p, 3) - 0.5) * 12, (rnd(i * 10 + p, 4) - 0.5) * 2.6, (rnd(i * 10 + p, 5) - 0.5) * 4);
      grp.add(puff);
    }
    grp.position.set(-90 + rnd(i, 6) * 180, 34 + rnd(i, 7) * 30, -90 - rnd(i, 8) * 90);
    scene.add(grp);
    clouds.push({ grp, speed: 0.7 + rnd(i, 9) * 1.1 });
  }

  // ===================================================================
  //  FACADE TEXTURE VARIANTS  (shared across all buildings → cheap)
  // ===================================================================
  // Each variant maps once per box face. A day "map" (wall + glass) and an
  // emissive map (black except lit windows) let only windows glow at night.
  function makeFacade(cols: number, rows: number, hue: number, seed: number) {
    const cw = 16;
    const cv = document.createElement('canvas');
    cv.width = cols * cw;
    cv.height = rows * cw;
    const ev = document.createElement('canvas');
    ev.width = cv.width;
    ev.height = cv.height;
    const g = cv.getContext('2d')!;
    const e = ev.getContext('2d')!;

    const wallL = 50 + rnd(seed, 70) * 26;
    g.fillStyle = `hsl(${hue}, 16%, ${wallL}%)`;
    g.fillRect(0, 0, cv.width, cv.height);
    e.fillStyle = '#000';
    e.fillRect(0, 0, ev.width, ev.height);

    const m = 3;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + m;
        const y = r * cw + m;
        const ww = cw - m * 2;
        const hh = cw - m * 2;
        g.fillStyle = `hsl(${hue + 6}, 40%, ${64 + rnd(seed + r * 13 + c, 71) * 16}%)`;
        g.fillRect(x, y, ww, hh);
        if (rnd(seed + r * 31 + c * 7, 72) > 0.3) {
          const warm = rnd(seed + r + c, 73);
          e.fillStyle = warm > 0.78 ? '#bfe4ff' : warm > 0.4 ? '#ffd98a' : '#ffbf66';
          e.fillRect(x, y, ww, hh);
        }
      }
    }
    const map = new THREE.CanvasTexture(cv);
    map.anisotropy = 4;
    const emissiveMap = new THREE.CanvasTexture(ev);
    return { map, emissiveMap };
  }

  // height bins keep windows roughly square regardless of tower height
  const facadeBins = [
    { maxH: 9, rows: 4 },
    { maxH: 16, rows: 7 },
    { maxH: 26, rows: 11 },
    { maxH: 999, rows: 16 }
  ];
  const hues = [205, 210, 198, 216, 192];
  const facadeVariants = facadeBins.map((bin) =>
    hues.map((hue, hi) => makeFacade(4, bin.rows, hue, bin.maxH * 7 + hi * 3))
  );
  function facadeFor(h: number, seed: number) {
    let bi = facadeBins.findIndex((b) => h <= b.maxH);
    if (bi < 0) bi = facadeBins.length - 1;
    return facadeVariants[bi][Math.floor(rnd(seed, 60) * hues.length)];
  }

  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x141821, side: THREE.BackSide });
  function addOutline(mesh: THREE.Mesh, s = 1.035) {
    const hull = new THREE.Mesh(mesh.geometry, outlineMat);
    hull.scale.setScalar(s);
    mesh.add(hull);
    return hull;
  }

  function towerMaterial(h: number, seed: number) {
    const { map, emissiveMap } = facadeFor(h, seed);
    const mat = new THREE.MeshToonMaterial({
      map,
      color: new THREE.Color().setHSL(0.58, 0.08, 0.58 + rnd(seed, 61) * 0.18),
      emissive: new THREE.Color(0xffffff),
      emissiveMap,
      emissiveIntensity: 0
    });
    litMats.push(mat);
    return mat;
  }

  // one windowed storey-block
  function block(w: number, h: number, d: number, seed: number) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), towerMaterial(h, seed));
    addOutline(mesh);
    return mesh;
  }

  // ===================================================================
  //  GENERIC TOWERS
  // ===================================================================
  function makeTower(seed: number, maxH: number) {
    const grp = new THREE.Group();
    const form = rnd(seed, 80);
    const baseW = 3.0 + rnd(seed, 81) * 3.2;
    const baseD = 2.8 + rnd(seed, 82) * 2.8;

    if (form < 0.45) {
      // plain imposing slab
      const h = Math.min(maxH, 8 + rnd(seed, 83) * (maxH - 8));
      const b = block(baseW, h, baseD, seed);
      b.position.y = h / 2;
      grp.add(b);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(baseW * 1.05, 0.6, baseD * 1.05), new THREE.MeshToonMaterial({ color: 0x394150 }));
      cap.position.y = h + 0.3;
      grp.add(cap);
    } else if (form < 0.8) {
      // art-deco setback wedding cake
      let h = 0;
      let w = baseW * 1.25;
      let d = baseD * 1.25;
      const tiers = 3 + Math.floor(rnd(seed, 84) * 2);
      const tierH = (maxH * 0.92) / tiers;
      for (let i = 0; i < tiers; i++) {
        const th = tierH * (0.8 + rnd(seed + i, 85) * 0.5);
        const b = block(w, th, d, seed + i * 100);
        b.position.y = h + th / 2;
        grp.add(b);
        h += th;
        w *= 0.74;
        d *= 0.74;
      }
      const spire = new THREE.Mesh(new THREE.ConeGeometry(w * 0.5, 2.5 + rnd(seed, 86) * 3, 6), new THREE.MeshToonMaterial({ color: 0xcfd6e0 }));
      spire.position.y = h + 1.2;
      grp.add(spire);
    } else {
      // tall glass tower + antenna beacon
      const h = Math.min(maxH * 1.15, 14 + rnd(seed, 87) * maxH);
      const b = block(baseW, h, baseD, seed);
      b.position.y = h / 2;
      grp.add(b);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, 4.5, 6), new THREE.MeshToonMaterial({ color: 0x2c313c }));
      antenna.position.y = h + 2.25;
      grp.add(antenna);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a5a }));
      beacon.position.y = h + 4.6;
      grp.add(beacon);
      grp.userData.beacon = beacon;
    }
    return grp;
  }

  const beacons: THREE.Mesh[] = [];

  // ===================================================================
  //  STREET DRESSING — cross-streets, crosswalks, centre dashes
  // ===================================================================
  const sidewalkMat = new THREE.MeshToonMaterial({ color: 0xaeb4ba, side: THREE.DoubleSide });
  const crossRoadMat = new THREE.MeshToonMaterial({ color: 0x33363c, side: THREE.DoubleSide });
  const curbMat = new THREE.MeshBasicMaterial({ color: 0x15171c, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  // kept below the bloom threshold so crosswalks read crisp instead of glowing as the camera nears them
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xc2c7cd, side: THREE.DoubleSide, depthWrite: false });
  const dashMats: THREE.MeshBasicMaterial[] = [];

  // continuous sidewalk slab on both sides of the avenue
  for (const side of [-1, 1]) {
    const b0 = side > 0 ? roadHalfAng + 0.001 : -bMax;
    const b1 = side > 0 ? bMax : -roadHalfAng - 0.001;
    addPlanetPatch(0, TAU, b0, b1, R + 0.04, sidewalkMat, 200, 8, 1);
  }

  const intersectionAngles: number[] = [];
  for (let i = 0; i < N_CROSS; i++) intersectionAngles.push(i * CROSS_ANG);

  // zebra stripes across a span; orientation depends on which road they cross
  function zebra(aCenter: number, bCenter: number, alongAvenue: boolean) {
    const stripe = 0.42 / R;
    const gap = 0.4 / R;
    const halfDepth = 0.95 / R;
    const lift = R + 0.16;
    if (alongAvenue) {
      // stripes run across the avenue (vary b), placed at aCenter
      let b = -roadHalfAng + 0.2 / R;
      while (b < roadHalfAng - 0.2 / R) {
        addPlanetPatch(aCenter - halfDepth, aCenter + halfDepth, b, Math.min(b + stripe, roadHalfAng), lift, zebraMat, 1, 1, 9);
        b += stripe + gap;
      }
    } else {
      // stripes run across the cross-street (vary a), placed at bCenter
      let a = -crossHalfAng + 0.2 / R;
      while (a < crossHalfAng - 0.2 / R) {
        addPlanetPatch(aCenter + a, aCenter + Math.min(a + stripe, crossHalfAng), bCenter - halfDepth, bCenter + halfDepth, lift, zebraMat, 1, 1, 9);
        a += stripe + gap;
      }
    }
  }

  for (let i = 0; i < N_CROSS; i++) {
    const a = intersectionAngles[i];
    // the cross-street itself (asphalt band spanning the city width)
    addPlanetPatch(a - crossHalfAng, a + crossHalfAng, -bMax, bMax, R + 0.05, crossRoadMat, 3, 40, 2);
    // curbs framing the cross-street
    addPlanetPatch(a - crossHalfAng - 0.02, a - crossHalfAng, -bMax, bMax, R + 0.06, curbMat, 1, 40, 5);
    addPlanetPatch(a + crossHalfAng, a + crossHalfAng + 0.02, -bMax, bMax, R + 0.06, curbMat, 1, 40, 5);
    // four crosswalks framing the open intersection (no lane lines inside it)
    const setback = crossHalfAng + 0.9 / R;
    zebra(a - setback, 0, true);
    zebra(a + setback, 0, true);
    zebra(a, -roadHalfAng - 0.9 / R, false);
    zebra(a, roadHalfAng + 0.9 / R, false);
  }

  // avenue centre dashes (yellow), skipping each intersection box
  {
    const dashGeo = new THREE.BoxGeometry(0.16, 0.05, 1.6);
    const clearance = crossHalfAng + 1.6 / R;
    for (let i = 0; i < 150; i++) {
      const a = (i / 150) * TAU;
      let nearCross = false;
      for (const ca of intersectionAngles) {
        if (Math.abs(Math.atan2(Math.sin(a - ca), Math.cos(a - ca))) < clearance) {
          nearCross = true;
          break;
        }
      }
      if (nearCross) continue;
      const m = new THREE.MeshBasicMaterial({ color: 0xf2c640 });
      dashMats.push(m);
      onPlanet(new THREE.Mesh(dashGeo, m), a, 0, 0.11);
    }
  }

  // ===================================================================
  //  THE BUILDING FIELD — dense blocks between every intersection
  // ===================================================================
  // landmark plazas: reserve one block-side per landmark and keep its front clear
  // so the landmark reads against the skyline instead of hiding behind a lane.
  const landmarkSlots = [
    { type: 'needle', k: 1, side: -1, lat: 10, yaw: 0.3, scale: 0.6 },
    { type: 'liberty', k: 3, side: 1, lat: 10, yaw: -0.4, scale: 1.15 },
    { type: 'pyramid', k: 5, side: -1, lat: 11, yaw: 0, scale: 1.15 },
    { type: 'dome', k: 7, side: 1, lat: 13, yaw: -0.5, scale: 1.2 },
    { type: 'ferris', k: 9, side: -1, lat: 14, yaw: -0.35, scale: 1.15 },
    { type: 'needle', k: 11, side: 1, lat: 10, yaw: 0.35, scale: 0.6 },
    { type: 'pyramid', k: 13, side: -1, lat: 11, yaw: 0, scale: 1.15 },
    { type: 'dome', k: 14, side: 1, lat: 13, yaw: 0.5, scale: 1.2 }
  ];
  const reservedFront = new Set(landmarkSlots.map((l) => l.k + ':' + l.side));

  const NEAR_LAT = ROAD_WIDTH / 2 + 6.5;
  let bSeed = 7000;
  for (let k = 0; k < N_CROSS; k++) {
    const aStart = intersectionAngles[k] + crossHalfAng + 1.6 / R;
    const aEnd = intersectionAngles[k] + CROSS_ANG - crossHalfAng - 1.6 / R;
    const blockSpan = aEnd - aStart;
    if (blockSpan <= 0) continue;
    for (const side of [-1, 1]) {
      // lanes of buildings marching back from the avenue; taller toward the back
      let lat = NEAR_LAT;
      let laneIdx = 0;
      const reserved = reservedFront.has(k + ':' + side);
      while (lat < CITY_HALF - 3) {
        const laneDepth = 5.2 + rnd(bSeed, 1) * 2.2;
        // keep the front of a reserved block open as a landmark plaza
        if (reserved && lat < 24) {
          lat += laneDepth;
          laneIdx++;
          continue;
        }
        const slots = 2 + Math.floor(rnd(bSeed, 2) * 2);
        for (let m = 0; m < slots; m++) {
          const seed = bSeed++;
          const a = aStart + blockSpan * ((m + 0.5) / slots) + (rnd(seed, 3) - 0.5) * (blockSpan / slots) * 0.5;
          const latJit = lat + (rnd(seed, 4) - 0.5) * 1.4;
          const maxH = 7 + laneIdx * 3.4 + rnd(seed, 5) * 10;
          const tower = makeTower(seed, maxH);
          tower.scale.setScalar(0.9 + rnd(seed, 6) * 0.4);
          onPlanet(tower, a, side * lateral(latJit), 0);
          tower.rotateY(Math.round(rnd(seed, 7) * 3) * (Math.PI / 2)); // axis-aligned, city-like
          if (tower.userData.beacon) beacons.push(tower.userData.beacon);
        }
        lat += laneDepth;
        laneIdx++;
      }
    }
  }

  // ===================================================================
  //  LANDMARKS
  // ===================================================================
  function makeSpaceNeedle(seed: number) {
    const grp = new THREE.Group();
    const concrete = new THREE.MeshToonMaterial({ color: 0xdfe3e8 });
    const accent = new THREE.MeshToonMaterial({ color: 0xc24a3a });
    const H = 22;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.8, H, 12), concrete);
    shaft.position.y = H / 2;
    addOutline(shaft, 1.04);
    grp.add(shaft);
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * TAU;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, H * 0.92, 6), concrete);
      leg.position.set(Math.cos(ang) * 1.3, H * 0.46, Math.sin(ang) * 1.3);
      leg.rotation.z = -Math.cos(ang) * 0.14;
      leg.rotation.x = Math.sin(ang) * 0.14;
      grp.add(leg);
    }
    const saucer = new THREE.Group();
    saucer.position.y = H;
    const underside = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.0, 24), concrete);
    underside.position.y = -0.5;
    saucer.add(underside);
    saucer.add(new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 1.4, 24), accent));
    const { map, emissiveMap } = makeFacade(28, 1, 210, seed + 3);
    const obsMat = new THREE.MeshToonMaterial({ map, emissive: new THREE.Color(0xffffff), emissiveMap, emissiveIntensity: 0 });
    litMats.push(obsMat);
    const obs = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 1.3, 24, 1, true), obsMat);
    obs.position.y = 0.2;
    saucer.add(obs);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.1, 1.3, 24), concrete);
    roof.position.y = 1.2;
    saucer.add(roof);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.22, 4, 6), concrete);
    spire.position.y = 3.2;
    saucer.add(spire);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a5a }));
    tip.position.y = 5.4;
    saucer.add(tip);
    beacons.push(tip);
    grp.add(saucer);
    return grp;
  }

  function makeStatueOfLiberty() {
    const grp = new THREE.Group();
    const copper = new THREE.MeshToonMaterial({ color: 0x3fa78a });
    const stone = new THREE.MeshToonMaterial({ color: 0x9b8e7a });
    const base = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.0, 5.4), stone);
    base.position.y = 1.5;
    addOutline(base);
    grp.add(base);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, 3.4, 12), stone);
    plinth.position.y = 4.7;
    grp.add(plinth);
    const figure = new THREE.Group();
    figure.position.y = 6.2;
    const robe = new THREE.Mesh(new THREE.ConeGeometry(2.0, 6.6, 14), copper);
    robe.position.y = 3.3;
    addOutline(robe, 1.03);
    figure.add(robe);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 2.1, 12), copper);
    torso.position.y = 6.2;
    figure.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), copper);
    head.position.y = 7.8;
    figure.add(head);
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI - Math.PI / 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.95, 5), copper);
      spike.position.set(Math.cos(ang) * 0.82, 8.3 + Math.sin(ang) * 0.12, Math.sin(ang) * 0.82);
      spike.rotation.z = -Math.cos(ang) * 1.1;
      spike.rotation.x = Math.sin(ang) * 1.1;
      figure.add(spike);
    }
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 3.4, 8), copper);
    arm.position.set(1.25, 7.9, 0);
    arm.rotation.z = -0.5;
    figure.add(arm);
    const torchCup = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.24, 0.7, 10), new THREE.MeshToonMaterial({ color: 0xc9a23a }));
    torchCup.position.set(2.1, 9.5, 0);
    figure.add(torchCup);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.05, 10), flameMat);
    flame.position.set(2.1, 10.3, 0);
    figure.add(flame);
    grp.userData.flame = flame;
    grp.userData.flameMat = flameMat;
    const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 2.4, 8), copper);
    lArm.position.set(-0.95, 6.0, 0.4);
    lArm.rotation.z = 0.5;
    figure.add(lArm);
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 0.34), new THREE.MeshToonMaterial({ color: 0x4fb39a }));
    tablet.position.set(-1.5, 5.2, 0.6);
    tablet.rotation.z = 0.3;
    figure.add(tablet);
    grp.add(figure);
    return grp;
  }

  function makePyramid(seed: number) {
    // Transamerica-style white pyramid tower
    const grp = new THREE.Group();
    const H = 30;
    const body = new THREE.Mesh(new THREE.ConeGeometry(5, H, 4), towerMaterial(H, seed));
    body.position.y = H / 2;
    body.rotation.y = Math.PI / 4;
    addOutline(body, 1.02);
    grp.add(body);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.4, 5, 4), new THREE.MeshToonMaterial({ color: 0xe6eaf0 }));
    spire.position.y = H + 2.5;
    spire.rotation.y = Math.PI / 4;
    grp.add(spire);
    return grp;
  }

  function makeDome(seed: number) {
    // Capitol-style domed civic building
    const grp = new THREE.Group();
    const stone = new THREE.MeshToonMaterial({ color: 0xe9e7df });
    const base = new THREE.Mesh(new THREE.BoxGeometry(11, 7, 8), stone);
    base.position.y = 3.5;
    addOutline(base);
    grp.add(base);
    // colonnade hint
    for (let i = -4; i <= 4; i++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 5.5, 7), stone);
      col.position.set(i * 1.1, 2.9, 4.1);
      grp.add(col);
    }
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 3, 16), stone);
    drum.position.y = 8.5;
    grp.add(drum);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.7, 16, 10, 0, TAU, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: 0x9fc7b8 }));
    dome.position.y = 10;
    addOutline(dome, 1.03);
    grp.add(dome);
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.4, 8), stone);
    lantern.position.y = 12.6;
    grp.add(lantern);
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe070 }));
    star.position.y = 13.7;
    grp.add(star);
    beacons.push(star);
    return grp;
  }

  function makeFerrisWheel(seed: number) {
    const grp = new THREE.Group();
    const steel = new THREE.MeshToonMaterial({ color: 0xc7ccd4 });
    const Rw = 7;
    // two A-frame supports
    for (const sx of [-2.4, 2.4]) {
      for (const dz of [-1.4, 1.4]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, Rw + 2.5, 6), steel);
        leg.position.set(sx, (Rw + 2.5) / 2, dz);
        leg.rotation.x = (dz > 0 ? 1 : -1) * 0.18;
        leg.rotation.z = (sx > 0 ? -1 : 1) * 0.12;
        grp.add(leg);
      }
    }
    const wheel = new THREE.Group();
    wheel.position.y = Rw + 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Rw, 0.22, 8, 40), steel);
    wheel.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(Rw * 0.62, 0.16, 8, 32), steel);
    wheel.add(ring2);
    const cabinMat = [0xff6b6b, 0xffd166, 0x6bcB77, 0x4d9de0, 0xc77dff];
    const spokes = 12;
    for (let i = 0; i < spokes; i++) {
      const ang = (i / spokes) * TAU;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, Rw, 5), steel);
      spoke.position.set((Math.cos(ang) * Rw) / 2, (Math.sin(ang) * Rw) / 2, 0);
      spoke.rotation.z = ang - Math.PI / 2;
      wheel.add(spoke);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.0), new THREE.MeshToonMaterial({ color: cabinMat[i % cabinMat.length] }));
      cabin.position.set(Math.cos(ang) * Rw, Math.sin(ang) * Rw, 0);
      wheel.add(cabin);
    }
    grp.add(wheel);
    grp.userData.wheel = wheel;
    return grp;
  }

  const ferrisWheels: THREE.Group[] = [];
  function placeLandmark(builder: () => THREE.Group, a: number, side: number, lat: number, yaw = 0, scale = 1) {
    const grp = builder();
    grp.scale.setScalar(scale);
    onPlanet(grp, a, side * lateral(lat), 0);
    grp.rotateY(yaw);
    return grp;
  }

  // Build each reserved plaza's landmark at the front of its block.
  const landmarkBuilders: Record<string, (s: number) => THREE.Group> = {
    needle: (s) => makeSpaceNeedle(s),
    liberty: () => makeStatueOfLiberty(),
    pyramid: (s) => makePyramid(s),
    dome: (s) => makeDome(s),
    ferris: (s) => makeFerrisWheel(s)
  };
  let statueFlameMat: THREE.MeshBasicMaterial | null = null;
  let lmSeed = 30;
  for (const slot of landmarkSlots) {
    const a = intersectionAngles[slot.k] + CROSS_ANG * 0.5;
    const grp = placeLandmark(() => landmarkBuilders[slot.type](lmSeed++), a, slot.side, slot.lat, slot.yaw, slot.scale ?? 1);
    if (slot.type === 'liberty') statueFlameMat = grp.userData.flameMat ?? null;
    if (slot.type === 'ferris' && grp.userData.wheel) ferrisWheels.push(grp.userData.wheel);
  }

  // ===================================================================
  //  CHARACTER
  // ===================================================================
  const character = createCharacter(options.character, rnd);
  scene.add(character.group);

  // ===================================================================
  //  CORNER TURNS  (disabled — pivot is broken)
  // ===================================================================
  // const ENABLE_TURNS = true;
  // const TURN_AT_CROSSING = 3;
  // let lastCrossIdx = 0;
  // let netHeading = 0;
  // let turning = false;
  // let turnSign = 1;
  // let turnElapsed = 0;
  // let turnApplied = 0;
  // const TURN_DURATION = 2.2;
  // function smoothstep(p: number) {
  //   p = Math.max(0, Math.min(1, p));
  //   return p * p * (3 - 2 * p);
  // }

  // ===================================================================
  //  RGB WINDOW STROBE (night + gradient toggle)
  // ===================================================================
  const rgbWindowStops = [
    new THREE.Color(0xc57984),
    new THREE.Color(0xb987a2),
    new THREE.Color(0x78a7c8),
    new THREE.Color(0x8aa4c7),
    new THREE.Color(0x86bd95),
    new THREE.Color(0xb3b778)
  ];
  const _wc = new THREE.Color();
  function rollingWindowColor(out: THREE.Color, phase: number) {
    const p = ((phase % 1) + 1) % 1;
    const scaled = p * rgbWindowStops.length;
    const idx = Math.floor(scaled) % rgbWindowStops.length;
    const next = (idx + 1) % rgbWindowStops.length;
    return out.lerpColors(rgbWindowStops[idx], rgbWindowStops[next], scaled - idx);
  }

  // ===================================================================
  //  ANIMATION
  // ===================================================================
  const CHAR_FPS = 30;
  let lastFrameIdx = -1;

  stage.run((t, dt) => {
    paintSky();
    paintSun();

    if (moonOn) {
      sunMesh.position.set(18, 34, -175);
      scene.fog.color.setHSL(0.6, 0.42, 0.12);
      scene.fog.near = 60;
      scene.fog.far = 220;
      hemiLight.color.setHSL(0.6, 0.4, 0.24);
      hemiLight.groundColor.setHSL(0.62, 0.3, 0.08);
      hemiLight.intensity = 0.5;
      sunLight.color.setHSL(0.62, 0.3, 0.55);
      sunLight.intensity = 0.28;
      sunLight.position.set(18, 34, -40);
      rim.color.setHSL(0.58, 0.4, 0.5);
      rim.intensity = 0.3;
      bloomPass.strength = 0.45;
      bloomPass.threshold = 0.75;
      cloudMat.color.setHSL(0.62, 0.18, 0.34);
    } else {
      sunMesh.position.set(-16, 30, -175);
      scene.fog.color.setHSL(0.55, 0.45, 0.72);
      scene.fog.near = 60;
      scene.fog.far = 215;
      hemiLight.color.setHSL(0.56, 0.4, 0.66);
      hemiLight.groundColor.setHSL(0.1, 0.2, 0.42);
      hemiLight.intensity = 0.92;
      sunLight.color.setHSL(0.13, 0.8, 0.7);
      sunLight.intensity = 0.85;
      sunLight.position.set(-16, 30, -40);
      rim.color.setHSL(0.55, 0.5, 0.72);
      rim.intensity = 0.35;
      bloomPass.strength = 0.45;
      bloomPass.threshold = 0.84;
      cloudMat.color.setHSL(0, 0, 1);
      for (const m of litMats) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 0; }
    }

    // Window lighting: RGB strobe at night when gradient is on, plain warm glow otherwise
    if (moonOn && gradientOn) {
      const roll = t * 0.04;
      for (let i = 0; i < litMats.length; i++) {
        rollingWindowColor(_wc, roll + i / litMats.length);
        litMats[i].emissive.copy(_wc);
        litMats[i].emissiveIntensity = 0.65;
      }
    } else if (moonOn) {
      for (const m of litMats) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.65; }
    }

    // rooftop beacons blink
    const blink = (Math.sin(t * 2.2) > 0 ? 1 : 0.15) * (moonOn ? 1 : 0.45);
    for (const b of beacons) b.material.color.setRGB(1, 0.25 + 0.25 * blink, 0.2 + 0.2 * blink);

    // torch flicker
    if (statueFlameMat) {
      const fl = 0.6 + 0.4 * Math.sin(t * 9) + 0.2 * Math.sin(t * 21);
      statueFlameMat.color.setHSL(0.12, 1, 0.55 + fl * 0.12);
    }
    // ferris wheels turn
    for (const w of ferrisWheels) w.rotation.z = t * 0.25;

    // clouds drift
    for (const c of clouds) {
      c.grp.position.x += dt * c.speed;
      if (c.grp.position.x > 95) c.grp.position.x = -95;
    }

    // ---- corner turn (disabled) ----
    // if (ENABLE_TURNS && !stage.reduceMotion) { ... }

    if (!stage.reduceMotion) {
      const frameIdx = Math.floor(t * CHAR_FPS);
      if (frameIdx !== lastFrameIdx) {
        lastFrameIdx = frameIdx;
        character.update(frameIdx / CHAR_FPS, frameIdx);
      }
    } else {
      character.update(0, 0);
    }

    cameraRig.apply(stage.reduceMotion ? 0 : Math.sin(t * 0.8) * 1.0);
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
