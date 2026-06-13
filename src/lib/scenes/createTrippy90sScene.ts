// @ts-nocheck
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createCharacter } from '../characters';
import type { CharacterDefinition, SceneDefinition } from '../registry/types';

export type Trippy90sSceneOptions = {
  scene: SceneDefinition;
  character: CharacterDefinition;
};

export function createTrippy90sScene(container: HTMLElement, options: Trippy90sSceneOptions) {

const TAU = Math.PI * 2;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function rnd(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---------- tempo / clocks ----------
const BPM = 80;
const BEAT = BPM / 60;
const CHAR_FPS = 8;            // stop-motion clock for the character
const BOIL_FPS = 6;            // 90s line-boil clock for the world's inked outlines
const WALK_SPEED = 4.2;        // ground speed kept from v3 — same surface roll rate

// ---------- renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1a0b33, 22, 80);

const camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 3.4, 7.6);
camera.lookAt(0, 1.9, -10);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.18,   // strength — subtle glow, only the sun corona and neon signs
  0.40,   // radius
  0.92    // threshold — only near-white elements bloom, everything else stays clean
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const onResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.resolution.set(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', onResize);

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0xbfa0ff, 0x40206a, 0.95));
const sunLight = new THREE.DirectionalLight(0xffd9a0, 0.85);
sunLight.position.set(0, 18, -40);
scene.add(sunLight);
const rim = new THREE.DirectionalLight(0x66e0ff, 0.35);
rim.position.set(6, 8, 10);
scene.add(rim);

// ---------- sky backdrop + melting sun ----------
const skyCv = document.createElement('canvas'); skyCv.width = 4; skyCv.height = 256;
const skyTex = new THREE.CanvasTexture(skyCv);
skyTex.magFilter = THREE.LinearFilter;
skyTex.minFilter = THREE.LinearFilter;
scene.background = skyTex;
const sunCv = document.createElement('canvas'); sunCv.width = 256; sunCv.height = 256;
const sunTex = new THREE.CanvasTexture(sunCv);
const sunMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(66, 66),
  new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false })
);
sunMesh.position.set(0, 14, -95);
sunMesh.renderOrder = -1;
scene.add(sunMesh);

function paintSky(t) {
  const g = skyCv.getContext('2d');
  // Breathes gently in the warm sunset palette — never leaves purple-to-orange
  const breathe = Math.sin(t * 0.07) * 0.5 + 0.5;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0,    `hsl(${252 + breathe * 16},72%,7%)`);    // deep indigo-black
  grad.addColorStop(0.35, `hsl(${268 + breathe * 10},68%,18%)`);   // rich purple
  grad.addColorStop(0.62, `hsl(${300 + breathe * 8},72%,30%)`);    // pink-violet
  grad.addColorStop(0.83, `hsl(${330 + breathe * 6},80%,43%)`);    // rose-pink
  grad.addColorStop(1,    `hsl(${32 + breathe * 10},90%,58%)`);    // golden-orange horizon
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  skyTex.needsUpdate = true;
}
function paintSun(t) {
  const g = sunCv.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  // Warm gold corona glow
  const corona = g.createRadialGradient(128, 128, 42, 128, 128, 128);
  corona.addColorStop(0,   'hsla(44, 100%, 72%, 0.92)');
  corona.addColorStop(0.5, 'hsla(32, 100%, 62%, 0.45)');
  corona.addColorStop(1,   'hsla(28, 100%, 55%, 0)');
  g.fillStyle = corona; g.fillRect(0, 0, 256, 256);
  g.save();
  g.beginPath(); g.arc(128, 128, 96, 0, TAU); g.clip();
  // Retro gold base
  g.fillStyle = 'hsl(44, 100%, 64%)';
  g.fillRect(0, 0, 256, 256);
  // Iconic lo-fi retro horizontal bands — only in the lower half
  g.fillStyle = 'hsl(12, 95%, 50%)';
  const scroll = reduceMotion ? 0 : (t * 9) % 28;
  for (let i = 0; i < 7; i++) {
    const bandH = 6 + i * 2;   // bands get thicker toward bottom
    const bandY = 118 + i * 28 + scroll;
    if (bandY > 224) break;
    g.fillRect(0, bandY, 256, bandH);
  }
  g.restore();
  sunTex.needsUpdate = true;
}

// ---------- THE PLANET: a true sphere, road on its great circle ----------
const R = 30;                                   // sphere radius — its arc bows across the frame
const STREET_COLOR = 0x12091d;                    // dark road tone from the red-circled sample
const SIDEWALK_COLOR = 0x34214f;                  // lighter sidewalk/block tone from the yellow-circled sample
const CURB_COLOR = 0x0d0618;
const CITY_EDGE_W = 21.5;                         // lateral city width on each side of the walking road
const GRID_BLOCKS = 8;                            // roughly 2–4 buildings per block between streets
const CROSS_ROAD_W = 2.15;
const GRID_ROAD_OFFSET = 0.34;
const FULL_CROSS_STREETS = Array.from({ length: GRID_BLOCKS }, (_, i) => GRID_ROAD_OFFSET + i * TAU / GRID_BLOCKS);
const T_STREETS = [
  { side:  1, a: GRID_ROAD_OFFSET + 0.50 * TAU / GRID_BLOCKS, reach: 0.64 },
  { side: -1, a: GRID_ROAD_OFFSET + 1.55 * TAU / GRID_BLOCKS, reach: 0.70 },
  { side:  1, a: GRID_ROAD_OFFSET + 3.42 * TAU / GRID_BLOCKS, reach: 0.76 },
  { side: -1, a: GRID_ROAD_OFFSET + 5.28 * TAU / GRID_BLOCKS, reach: 0.62 },
  { side:  1, a: GRID_ROAD_OFFSET + 6.45 * TAU / GRID_BLOCKS, reach: 0.68 }
];
const planet = new THREE.Group();
planet.position.set(0, -R, 0);                  // top of sphere = y 0
scene.add(planet);

// the globe
const ground = new THREE.Mesh(
  new THREE.SphereGeometry(R, 72, 48),
  new THREE.MeshToonMaterial({ color: SIDEWALK_COLOR })
);
planet.add(ground);

// road: an equatorial band on a slightly larger sphere, poles tipped onto the X axis
const ROAD_W = 6.4;
const roadHalfAng = (ROAD_W / 2) / R;
const road = new THREE.Mesh(
  new THREE.SphereGeometry(R + 0.07, 96, 10, 0, TAU, Math.PI / 2 - roadHalfAng, roadHalfAng * 2),
  new THREE.MeshToonMaterial({ color: STREET_COLOR, side: THREE.DoubleSide })
);
road.rotation.z = Math.PI / 2;                  // equator now runs through the top, under his feet
planet.add(road);

// place an object on the sphere: a = angle along the road, b = lateral tilt, h = radial lift
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0), _Z = new THREE.Vector3(0, 0, 1);
function onPlanet(obj, a, b, h) {
  const r = R + h;
  obj.position.set(
    r * Math.sin(b),
    r * Math.cos(b) * Math.cos(a),
    r * Math.cos(b) * Math.sin(a)
  );
  _qa.setFromAxisAngle(_X, a);
  _qb.setFromAxisAngle(_Z, -b);
  obj.quaternion.multiplyQuaternions(_qa, _qb);   // tilt sideways, then roll along the road
  planet.add(obj);
}

// center dashes only — the grid below handles real cross streets instead of random road stripes
const dashMats = [], stripMats = [], crosswalkMats = [];
{
  const dashGeo = new THREE.BoxGeometry(0.22, 0.05, 1.4);
  const fullIntersectionDashClearance = (CROSS_ROAD_W / 2 + 0.95) / R;
  function dashInsideFullIntersection(a) {
    for (const roadA of FULL_CROSS_STREETS) {
      if (Math.abs(Math.atan2(Math.sin(a - roadA), Math.cos(a - roadA))) < fullIntersectionDashClearance) return true;
    }
    return false;
  }
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * TAU;
    if (dashInsideFullIntersection(a)) continue;
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
    dashMats.push(m);
    onPlanet(new THREE.Mesh(dashGeo, m), a, 0, 0.13);
  }
}

function planetPatchGeometry(a0, a1, b0, b1, r, aSeg = 4, bSeg = 4) {
  const vertices = [];
  const indices = [];
  for (let ia = 0; ia <= aSeg; ia++) {
    const a = a0 + (a1 - a0) * (ia / aSeg);
    for (let ib = 0; ib <= bSeg; ib++) {
      const b = b0 + (b1 - b0) * (ib / bSeg);
      vertices.push(
        r * Math.sin(b),
        r * Math.cos(b) * Math.cos(a),
        r * Math.cos(b) * Math.sin(a)
      );
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
  return geo;
}

function addPlanetPatch(a0, a1, b0, b1, r, mat, aSeg = 4, bSeg = 4, renderOrder = 1) {
  const mesh = new THREE.Mesh(planetPatchGeometry(a0, a1, b0, b1, r, aSeg, bSeg), mat);
  mesh.renderOrder = renderOrder;
  planet.add(mesh);
  return mesh;
}

function multiPlanetPatchGeometry(rects, r, aSeg = 1, bSeg = 1) {
  const vertices = [];
  const indices = [];
  let offset = 0;
  for (const rect of rects) {
    const [a0, a1, b0, b1] = rect;
    for (let ia = 0; ia <= aSeg; ia++) {
      const a = a0 + (a1 - a0) * (ia / aSeg);
      for (let ib = 0; ib <= bSeg; ib++) {
        const b = b0 + (b1 - b0) * (ib / bSeg);
        vertices.push(
          r * Math.sin(b),
          r * Math.cos(b) * Math.cos(a),
          r * Math.cos(b) * Math.sin(a)
        );
      }
    }
    const row = bSeg + 1;
    for (let ia = 0; ia < aSeg; ia++) {
      for (let ib = 0; ib < bSeg; ib++) {
        const p = offset + ia * row + ib;
        indices.push(p, p + row, p + 1, p + 1, p + row, p + row + 1);
      }
    }
    offset += (aSeg + 1) * (bSeg + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addPlanetMultiPatch(rects, r, mat, aSeg = 1, bSeg = 1, renderOrder = 8) {
  if (!rects.length) return null;
  const mesh = new THREE.Mesh(multiPlanetPatchGeometry(rects, r, aSeg, bSeg), mat);
  mesh.renderOrder = renderOrder;
  planet.add(mesh);
  return mesh;
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function positiveAngleSpan(a0, a1) {
  let span = a1 - a0;
  while (span <= 0) span += TAU;
  return span;
}

function sideStreetAngles(side) {
  return FULL_CROSS_STREETS.concat(T_STREETS.filter(t => t.side === side).map(t => t.a));
}

function pushAwayFromStreetAngles(a, side, clearanceWorld, seed) {
  let out = a;
  const minAng = clearanceWorld / R;
  for (let pass = 0; pass < 3; pass++) {
    for (const roadA of sideStreetAngles(side)) {
      const delta = angleDelta(out, roadA);
      if (Math.abs(delta) < minAng) {
        const dir = Math.abs(delta) < 0.0001 ? (rnd(seed + pass, 97) > 0.5 ? 1 : -1) : Math.sign(delta);
        out = roadA + dir * (minAng + 0.018 + rnd(seed + pass, 99) * 0.014);
      }
    }
  }
  return out;
}

function gridBlockAngle(blockIdx, ordinal, perBlock, clearanceWorld, seed) {
  const seg = TAU / GRID_BLOCKS;
  const roadHalf = (CROSS_ROAD_W / 2) / R;
  const clear = clearanceWorld / R;
  const start = GRID_ROAD_OFFSET + blockIdx * seg + roadHalf + clear;
  const end = GRID_ROAD_OFFSET + (blockIdx + 1) * seg - roadHalf - clear;
  const span = Math.max(0.08, positiveAngleSpan(start, end));
  const slot = (ordinal + 0.5) / perBlock;
  const jitter = (rnd(seed, 3) - 0.5) * Math.min(0.18 / perBlock, 0.055);
  return start + span * Math.min(0.94, Math.max(0.06, slot + jitter));
}

// ---------- melted 90s buildings with thick boiling outlines + drip cycles ----------
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x0d0618, side: THREE.BackSide });
const DROP_OUTLINE = new THREE.MeshBasicMaterial({ color: 0x0d0618, side: THREE.BackSide });
const INK_LINE = new THREE.LineBasicMaterial({ color: 0x0d0618, transparent: true, opacity: 0.92 });
const WINDOW_INK = new THREE.LineBasicMaterial({ color: 0x0d0618, transparent: true, opacity: 0.94, depthWrite: false });
const FOUNDATION_TOP = 0.12;
const SIDEWALK_LIFT = 0.095;

function makeLine(points, mat = INK_LINE) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat);
}

function makePlaneOutline(w, h) {
  const z = 0.012;
  const pts = [
    new THREE.Vector3(-w / 2, -h / 2, z),
    new THREE.Vector3( w / 2, -h / 2, z),
    new THREE.Vector3( w / 2,  h / 2, z),
    new THREE.Vector3(-w / 2,  h / 2, z)
  ];
  const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), WINDOW_INK);
  outline.renderOrder = 6;
  return outline;
}

function makeCenterEdgeInk(w, h, d, melt, side, seed) {
  const pts = [];
  for (let k = 0; k <= 13; k++) {
    const ny = k / 13;
    let y = ny * h;
    const bulge = 1 + melt * 0.45 * Math.pow(1 - ny, 2);
    const drift = Math.sin(ny * 9 + seed * 7) * melt * 0.18 * w * (1 - ny);
    const roofSag = ny > 0.92 ? melt * 0.18 * Math.min(w, d) * (ny - 0.92) / 0.08 : 0;
    const x = -side * (w / 2 * bulge + 0.075) + drift;
    const z = d / 2 * bulge + 0.085;
    pts.push(new THREE.Vector3(x, y - roofSag, z));
  }
  const line = makeLine(pts);
  line.position.y = FOUNDATION_TOP;
  line.renderOrder = 5;
  return line;
}

function teardropGeometry() {
  const profile = [
    new THREE.Vector2(0.015, 0.98),
    new THREE.Vector2(0.085, 0.70),
    new THREE.Vector2(0.250, 0.33),
    new THREE.Vector2(0.390, -0.08),
    new THREE.Vector2(0.360, -0.46),
    new THREE.Vector2(0.190, -0.82),
    new THREE.Vector2(0.020, -0.98)
  ];
  const geo = new THREE.LatheGeometry(profile, 14);
  geo.computeVertexNormals();
  return geo;
}

function meltGeometry(w, h, d, melt, seed) {
  const geo = new THREE.BoxGeometry(w, h, d, 4, 8, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ny = (y + h / 2) / h;
    const bulge = 1 + melt * 0.45 * Math.pow(1 - ny, 2);     // pooled wax base
    x *= bulge; z *= bulge;
    x += Math.sin(ny * 9 + seed * 7) * melt * 0.18 * w * (1 - ny);
    if (ny > 0.92) {                                          // sagging roof
      const cx = 1 - Math.min(1, Math.abs(x) / (w / 2));
      const cz = 1 - Math.min(1, Math.abs(z) / (d / 2));
      y -= melt * 0.6 * cx * cz * Math.min(w, d);
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function addCityGridSurface() {
  const sidewalkMat = new THREE.MeshToonMaterial({ color: SIDEWALK_COLOR, side: THREE.DoubleSide });
  const streetMat = new THREE.MeshToonMaterial({ color: STREET_COLOR, side: THREE.DoubleSide });
  const curbMat = new THREE.MeshBasicMaterial({ color: CURB_COLOR, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false });
  const cityEdgeAng = CITY_EDGE_W / R;
  const roadHalf = (CROSS_ROAD_W / 2) / R;
  const curbAng = 0.020;
  const crosswalkLift = R + SIDEWALK_LIFT + 0.078;
  const crosswalkDepth = 0.110 / R;
  const crosswalkStripe = 0.180 / R;
  const crosswalkGap = 0.175 / R;
  const crosswalkSetback = 0.260 / R;
  const roadMargin = 0.220 / R;

  function makeCrosswalkMat(seed) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.90,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    mat.userData.seed = seed;
    crosswalkMats.push(mat);
    return mat;
  }

  function addZebraAcrossMainRoad(a, seed) {
    const rects = [];
    const bMin = -roadHalfAng + roadMargin;
    const bMax =  roadHalfAng - roadMargin;
    let b = bMin;
    while (b < bMax - 0.001) {
      const b1 = Math.min(b + crosswalkStripe, bMax);
      rects.push([a - crosswalkDepth, a + crosswalkDepth, b, b1]);
      b += crosswalkStripe + crosswalkGap;
    }
    addPlanetMultiPatch(rects, crosswalkLift, makeCrosswalkMat(seed), 1, 1, 9);
  }

  function addZebraAcrossSideStreet(a, b, seed) {
    const rects = [];
    const aMin = a - roadHalf + roadMargin;
    const aMax = a + roadHalf - roadMargin;
    let x = aMin;
    while (x < aMax - 0.001) {
      const x1 = Math.min(x + crosswalkStripe, aMax);
      rects.push([x, x1, b - crosswalkDepth, b + crosswalkDepth]);
      x += crosswalkStripe + crosswalkGap;
    }
    addPlanetMultiPatch(rects, crosswalkLift, makeCrosswalkMat(seed), 1, 1, 9);
  }

  function addFullIntersectionCrosswalks(a, seed) {
    addZebraAcrossMainRoad(a - roadHalf - crosswalkSetback, seed + 1);
    addZebraAcrossMainRoad(a + roadHalf + crosswalkSetback, seed + 2);
    addZebraAcrossSideStreet(a, -roadHalfAng - crosswalkSetback, seed + 3);
    addZebraAcrossSideStreet(a,  roadHalfAng + crosswalkSetback, seed + 4);
  }

  function addTIntersectionCrosswalk(t, seed) {
    const b = t.side > 0 ? roadHalfAng + crosswalkSetback : -roadHalfAng - crosswalkSetback;
    addZebraAcrossSideStreet(t.a, b, seed);
  }

  function makeLaneDividerMat(seed) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    mat.userData.seed = seed;
    stripMats.push(mat);
    return mat;
  }

  function addSideStreetLaneDividerSegment(a, bStart, bEnd, seed) {
    const rects = [];
    const dashHalfA = 0.045 / R;
    const dashLen = 0.58 / R;
    const dashGap = 0.46 / R;
    const lo = Math.min(bStart, bEnd);
    const hi = Math.max(bStart, bEnd);
    let b = lo;
    while (b < hi - 0.001) {
      const b1 = Math.min(b + dashLen, hi);
      rects.push([a - dashHalfA, a + dashHalfA, b, b1]);
      b += dashLen + dashGap;
    }
    if (rects.length) {
      addPlanetMultiPatch(rects, R + SIDEWALK_LIFT + 0.082, makeLaneDividerMat(seed), 1, 1, 7);
    }
  }

  function addFullSideStreetLaneDividers(a, seed) {
    const edgePad = 0.42 / R;
    const intersectionGap = crosswalkSetback + crosswalkDepth + 0.18 / R;
    addSideStreetLaneDividerSegment(a, -cityEdgeAng + edgePad, -roadHalfAng - intersectionGap, seed + 1);
    addSideStreetLaneDividerSegment(a,  roadHalfAng + intersectionGap,  cityEdgeAng - edgePad, seed + 2);
  }

  function addTSideStreetLaneDividers(t, seed) {
    const edgePad = 0.42 / R;
    const intersectionGap = crosswalkSetback + crosswalkDepth + 0.18 / R;
    const reachAng = cityEdgeAng * t.reach;
    if (t.side > 0) {
      addSideStreetLaneDividerSegment(t.a, roadHalfAng + intersectionGap, reachAng - edgePad, seed);
    } else {
      addSideStreetLaneDividerSegment(t.a, -reachAng + edgePad, -roadHalfAng - intersectionGap, seed);
    }
  }

  // The sidewalks are now the continuous lighter city blocks on both sides of the main walking road.
  for (const side of [-1, 1]) {
    const b0 = side > 0 ? roadHalfAng + 0.010 : -cityEdgeAng;
    const b1 = side > 0 ? cityEdgeAng : -roadHalfAng - 0.010;
    addPlanetPatch(0, TAU, b0, b1, R + SIDEWALK_LIFT, sidewalkMat, 128, 12, 1);

    // Strong curb where the dark walking street meets the lighter sidewalk blocks.
    const cb0 = side > 0 ? roadHalfAng - curbAng * 0.35 : -roadHalfAng - curbAng * 0.65;
    const cb1 = side > 0 ? roadHalfAng + curbAng * 0.65 : -roadHalfAng + curbAng * 0.35;
    addPlanetPatch(0, TAU, cb0, cb1, R + SIDEWALK_LIFT + 0.020, curbMat, 128, 2, 4);
  }

  // Full cross streets: these are the real horizontal roads in the grid, not random stripes.
  for (let i = 0; i < FULL_CROSS_STREETS.length; i++) {
    const a = FULL_CROSS_STREETS[i];
    addPlanetPatch(a - roadHalf, a + roadHalf, -cityEdgeAng, cityEdgeAng, R + SIDEWALK_LIFT + 0.035, streetMat, 3, 24, 3);
    addPlanetPatch(a - roadHalf - curbAng, a - roadHalf, -cityEdgeAng, cityEdgeAng, R + SIDEWALK_LIFT + 0.050, curbMat, 1, 24, 5);
    addPlanetPatch(a + roadHalf, a + roadHalf + curbAng, -cityEdgeAng, cityEdgeAng, R + SIDEWALK_LIFT + 0.050, curbMat, 1, 24, 5);
    addFullSideStreetLaneDividers(a, 3000 + i * 20);
    addFullIntersectionCrosswalks(a, 1000 + i * 20);
  }

  // T-intersection offshoots: they connect to the main walking road but stop inside one side of the city grid.
  for (let i = 0; i < T_STREETS.length; i++) {
    const t = T_STREETS[i];
    const reachAng = cityEdgeAng * t.reach;
    const b0 = t.side > 0 ? roadHalfAng : -reachAng;
    const b1 = t.side > 0 ? reachAng : -roadHalfAng;
    addPlanetPatch(t.a - roadHalf, t.a + roadHalf, b0, b1, R + SIDEWALK_LIFT + 0.040, streetMat, 3, 12, 3);
    addPlanetPatch(t.a - roadHalf - curbAng, t.a - roadHalf, b0, b1, R + SIDEWALK_LIFT + 0.055, curbMat, 1, 12, 5);
    addPlanetPatch(t.a + roadHalf, t.a + roadHalf + curbAng, b0, b1, R + SIDEWALK_LIFT + 0.055, curbMat, 1, 12, 5);
    addTSideStreetLaneDividers(t, 4000 + i * 20);
    addTIntersectionCrosswalk(t, 2000 + i * 20);
  }
}
function makeFoundationPad(w, d, melt, seed, depth = 0) {
  const grp = new THREE.Group();
  const bottomBulge = 1 + melt * 0.45;
  const baseW = w * bottomBulge + 0.95 + depth * 0.2;
  const baseD = d * bottomBulge + 0.95 + depth * 0.12;

  const padMat = new THREE.MeshToonMaterial({ color: SIDEWALK_COLOR });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(baseW, FOUNDATION_TOP, baseD), padMat);
  pad.position.y = FOUNDATION_TOP / 2;
  grp.add(pad);

  const padHull = new THREE.Mesh(pad.geometry, OUTLINE);
  padHull.scale.set(1.025, 1.18, 1.025);
  pad.add(padHull);

  const curbMat = new THREE.MeshBasicMaterial({ color: 0x0d0618, transparent: true, opacity: 0.86 });
  const frontCurb = new THREE.Mesh(new THREE.BoxGeometry(baseW * 0.94, 0.035, 0.050), curbMat);
  frontCurb.position.set(0, FOUNDATION_TOP + 0.018, baseD / 2 + 0.020);
  grp.add(frontCurb);

  const rearCurb = new THREE.Mesh(new THREE.BoxGeometry(baseW * 0.78, 0.026, 0.038), curbMat);
  rearCurb.position.set(0, FOUNDATION_TOP + 0.012, -baseD / 2 - 0.014);
  rearCurb.material.opacity = 0.48;
  grp.add(rearCurb);

  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x0d0618,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(baseW * 1.06, baseD * 1.08), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  shadow.renderOrder = 3;
  grp.add(shadow);

  return { grp, mats: [padMat], hull: padHull };
}

function addWindowsToBuilding(grp, winMats, w, h, d, melt, side, seed, opts) {
  const winScale = opts.winScale || 1;
  const winW = 0.62 * winScale;
  const winH = 0.85 * winScale;
  const winGeo = new THREE.PlaneGeometry(winW, winH);
  const rowSpacing = opts.rowSpacing || 1.7;
  const rows = Math.max(2, Math.min(opts.maxRows || 99, Math.floor(h / rowSpacing)));
  const cleanWindows = opts.cleanWindows !== false;
  const outwardLift = 0.185;
  const edgeMargin = Math.max(0.135, winScale * 0.18);

  function profileAt(localY) {
    const ny = Math.max(0, Math.min(1, localY / h));
    const bulge = 1 + melt * 0.45 * Math.pow(1 - ny, 2);
    const drift = Math.sin(ny * 9 + seed * 7) * melt * 0.18 * w * (1 - ny);
    return {
      ny,
      bulge,
      drift,
      xMin: -w / 2 * bulge + drift,
      xMax:  w / 2 * bulge + drift,
      zMin: -d / 2 * bulge,
      zMax:  d / 2 * bulge
    };
  }

  function rectInsideMeltedFace(face, centerAcross, localY) {
    if (!cleanWindows) return true;
    if (winW < 0.22 || winH < 0.30) return false;

    const bottom = localY - winH / 2;
    const top = localY + winH / 2;
    if (bottom < 0.38) return false;
    if (top > h - 0.10) return false;

    const acrossMin = centerAcross - winW / 2;
    const acrossMax = centerAcross + winW / 2;
    const testY = [bottom, localY, top];

    for (const y of testY) {
      const p = profileAt(y);
      if (face === 'front') {
        if (acrossMin < p.xMin + edgeMargin) return false;
        if (acrossMax > p.xMax - edgeMargin) return false;
      } else {
        if (acrossMin < p.zMin + edgeMargin) return false;
        if (acrossMax > p.zMax - edgeMargin) return false;
      }
    }

    // Extra guardrail: melted silhouettes lean differently from row to row.
    // If the top and bottom profiles pinch the rectangle into an edge/corner, skip it
    // instead of allowing a half-covered window outline to render.
    const pBottom = profileAt(bottom);
    const pTop = profileAt(top);
    if (face === 'front') {
      const centerOffsetBottom = Math.abs(centerAcross - pBottom.drift);
      const centerOffsetTop = Math.abs(centerAcross - pTop.drift);
      const safeHalfBottom = (pBottom.xMax - pBottom.xMin) / 2 - edgeMargin;
      const safeHalfTop = (pTop.xMax - pTop.xMin) / 2 - edgeMargin;
      if (centerOffsetBottom + winW / 2 > safeHalfBottom) return false;
      if (centerOffsetTop + winW / 2 > safeHalfTop) return false;
    } else {
      const safeHalfBottom = (pBottom.zMax - pBottom.zMin) / 2 - edgeMargin;
      const safeHalfTop = (pTop.zMax - pTop.zMin) / 2 - edgeMargin;
      if (Math.abs(centerAcross) + winW / 2 > safeHalfBottom) return false;
      if (Math.abs(centerAcross) + winW / 2 > safeHalfTop) return false;
    }

    return true;
  }

  for (let r = 0; r < rows; r++) {
    const wy = FOUNDATION_TOP + 1.00 + r * ((h - 1.45) / rows);
    const localY = wy - FOUNDATION_TOP;
    const p = profileAt(localY);
    const sideZ = (rnd(seed + r, 83) - 0.5) * Math.min(0.045, d * 0.025);
    const frontX = p.drift + (rnd(seed + r, 87) - 0.5) * w * 0.14;
    const showSide = rectInsideMeltedFace('side', sideZ, localY);
    const showFront = !opts.sideOnly && rectInsideMeltedFace('front', frontX, localY);

    if (!showSide && !showFront) continue;

    const wm = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    winMats.push(wm);

    if (showSide) {
      const sideWin = new THREE.Mesh(winGeo, wm);
      sideWin.position.set(-side * (w / 2 * p.bulge + outwardLift) + p.drift, wy, sideZ);
      sideWin.rotation.y = -side * Math.PI / 2;
      sideWin.renderOrder = 5;
      sideWin.add(makePlaneOutline(winW, winH));
      grp.add(sideWin);
    }

    if (showFront) {
      const frontWin = new THREE.Mesh(winGeo, wm);
      frontWin.position.set(frontX, wy, d / 2 * p.bulge + outwardLift);
      frontWin.renderOrder = 5;
      frontWin.add(makePlaneOutline(winW, winH));
      grp.add(frontWin);
    }
  }
}

const buildings = [];   // { grp, hull, mat, winMats[], foundationMats, seed, baseQ, depth }
const drips = [];       // { mesh, mat, link, roofY, fallTo, period, phase }

addCityGridSurface();

function createCityBuilding({ side, seed, a, w, h, d, melt, lat, depth, opts, dripGeo }) {
  const b = side * (lat / R);
  const grp = new THREE.Group();

  const foundation = makeFoundationPad(w, d, melt, seed, depth);
  grp.add(foundation.grp);

  const geo = meltGeometry(w, h, d, melt, seed);
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: opts.opacity || 1 });
  const body = new THREE.Mesh(geo, mat);
  body.position.y = FOUNDATION_TOP + h / 2;
  grp.add(body);

  const hull = new THREE.Mesh(geo, OUTLINE);
  hull.position.y = FOUNDATION_TOP + h / 2;
  hull.scale.setScalar(opts.hullScale || 1.055);
  grp.add(hull);

  const centerEdge = makeCenterEdgeInk(w, h, d, melt, side, seed);
  grp.add(centerEdge);

  const winMats = [];
  addWindowsToBuilding(grp, winMats, w, h, d, melt, side, seed, opts);

  onPlanet(grp, a, b, 0);
  grp.rotateZ(-side * rnd(seed, 15) * (opts.lean || 0.055));

  const rec = {
    grp,
    hull,
    mat,
    winMats,
    foundationMats: foundation.mats,
    foundationHull: foundation.hull,
    centerEdge,
    seed,
    depth,
    sat: opts.sat || 0.85,
    lightBase: opts.lightBase || 0.50,
    baseQ: grp.quaternion.clone()
  };
  buildings.push(rec);

  if (opts.drips) {
    const nDrips = 1 + Math.floor(rnd(seed, 31) * 2);
    for (let dd = 0; dd < nDrips; dd++) {
      const dm = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true });
      const drop = new THREE.Mesh(dripGeo, dm);
      const dHull = new THREE.Mesh(dripGeo, DROP_OUTLINE);
      dHull.scale.setScalar(1.045);
      drop.add(dHull);
      const baseR = 0.14 + rnd(seed + dd, 33) * 0.10;
      drop.userData.baseR = baseR;
      drop.position.set(
        (rnd(seed + dd, 35) - 0.5) * w * 0.6,
        FOUNDATION_TOP + h * 0.9,
        d / 2 * 1.1 + 0.18
      );
      grp.add(drop);
      drips.push({
        mesh: drop, mat: dm, link: mat,
        roofY: FOUNDATION_TOP + h * 0.9,
        fallTo: FOUNDATION_TOP + 0.035,
        period: 8 + rnd(seed + dd, 37) * 6,
        phase: rnd(seed + dd, 39)
      });
    }
  }
}

{
  const dripGeo = teardropGeometry();
  const layers = [
    {
      name: 'front', count: 24, seedOffset: 0, latExtra: 1.05, latJitter: 0.95, aOffset: 0.00,
      wMin: 2.45, wVar: 2.05, hMin: 4.5, hVar: 6.0, dMin: 2.45, dVar: 1.75,
      meltMin: 0.55, meltVar: 0.80,
      opts: { drips: true, winScale: 1, maxRows: 7, rowSpacing: 1.7, lean: 0.045, sat: 0.86, lightBase: 0.50, hullScale: 1.058 }
    },
    {
      name: 'infill', count: 30, seedOffset: 4200, latExtra: 2.25, latJitter: 4.80, aOffset: 0.19,
      wMin: 0.95, wVar: 1.05, hMin: 2.9, hVar: 4.2, dMin: 0.90, dVar: 0.90,
      meltMin: 0.28, meltVar: 0.44,
      opts: { drips: false, winScale: 0.52, maxRows: 4, rowSpacing: 1.55, lean: 0.030, sat: 0.82, lightBase: 0.45, hullScale: 1.040, cleanWindows: true }
    },
    {
      name: 'mid', count: 28, seedOffset: 1200, latExtra: 5.15, latJitter: 1.05, aOffset: 0.47,
      wMin: 1.95, wVar: 2.35, hMin: 5.4, hVar: 7.0, dMin: 1.85, dVar: 1.35,
      meltMin: 0.38, meltVar: 0.55,
      opts: { drips: false, winScale: 0.78, maxRows: 5, rowSpacing: 1.95, lean: 0.035, sat: 0.78, lightBase: 0.43, hullScale: 1.047 }
    },
    {
      name: 'far', count: 32, seedOffset: 2600, latExtra: 9.45, latJitter: 1.45, aOffset: 0.23,
      wMin: 1.45, wVar: 2.25, hMin: 6.2, hVar: 8.8, dMin: 1.35, dVar: 1.05,
      meltMin: 0.25, meltVar: 0.40,
      opts: { drips: false, winScale: 0.58, maxRows: 4, rowSpacing: 2.25, lean: 0.026, sat: 0.66, lightBase: 0.37, hullScale: 1.038, sideOnly: false }
    }
  ];

  function angleGap(a, b) {
    return Math.abs(angleDelta(a, b)) * R;
  }

  function buildingFootprint(w, d, melt, depth) {
    const bottomBulge = 1 + melt * 0.45;
    return {
      width: w * bottomBulge + 1.05 + depth * 0.24,
      depth: d * bottomBulge + 1.05 + depth * 0.16
    };
  }

  function onStreetAngle(a, side, clearanceWorld) {
    const minAng = clearanceWorld / R;
    for (const roadA of sideStreetAngles(side)) {
      if (Math.abs(angleDelta(a, roadA)) < minAng) return true;
    }
    return false;
  }

  function validLatForCity(candidate) {
    const mainStreetEdge = ROAD_W / 2 + 0.46;
    const cityEdge = CITY_EDGE_W - 0.52;
    return candidate.lat - candidate.width * 0.5 >= mainStreetEdge &&
           candidate.lat + candidate.width * 0.5 <= cityEdge;
  }

  function overlapsPlaced(candidate, placed) {
    for (const item of placed) {
      const latGap = Math.abs(candidate.lat - item.lat);
      const roadGap = angleGap(candidate.a, item.a);
      const minLatGap = (candidate.width + item.width) * 0.5 + 0.62;
      const minRoadGap = (candidate.depth + item.depth) * 0.5 + 0.96;
      if (latGap < minLatGap && roadGap < minRoadGap) return true;
    }
    return false;
  }

  function candidateScore(candidate, placed) {
    let nearest = 99;
    for (const item of placed) {
      const latGap = Math.abs(candidate.lat - item.lat) - (candidate.width + item.width) * 0.5;
      const roadGap = angleGap(candidate.a, item.a) - (candidate.depth + item.depth) * 0.5;
      nearest = Math.min(nearest, Math.min(latGap, roadGap));
    }
    const mainStreetGap = candidate.lat - candidate.width * 0.5 - ROAD_W / 2;
    return nearest + mainStreetGap * 0.08;
  }

  function citySlot(layer, side, i, seed, w, d, melt, depth, placed) {
    const foot = buildingFootprint(w, d, melt, depth);
    const perBlock = Math.ceil(layer.count / GRID_BLOCKS);
    const blockIdx = i % GRID_BLOCKS;
    const ordinal = Math.floor(i / GRID_BLOCKS);
    const streetClearance = CROSS_ROAD_W / 2 + foot.depth * 0.58 + 0.62;
    const baseA = gridBlockAngle(blockIdx, ordinal, perBlock, streetClearance, seed);
    const minLat = ROAD_W / 2 + 0.46 + foot.width * 0.5;
    const maxLat = CITY_EDGE_W - 0.52 - foot.width * 0.5;
    const preferredLat = ROAD_W / 2 + layer.latExtra + foot.width * 0.42 + depth * 0.32;

    if (maxLat <= minLat) return null;

    let best = null;
    for (let attempt = 0; attempt < 42; attempt++) {
      const laneNudge = ((attempt % 7) - 3) * 0.30;
      const sweep = Math.floor(attempt / 7);
      const dir = attempt % 2 ? 1 : -1;
      const aShift = (attempt === 0 ? 0 : (0.016 + rnd(seed + attempt, 101) * 0.026) * (sweep + 1) * dir);
      const a = pushAwayFromStreetAngles(baseA + aShift, side, streetClearance, seed + attempt);
      const lat = Math.min(maxLat, Math.max(minLat, preferredLat + rnd(seed + attempt, 13) * layer.latJitter + laneNudge));
      const candidate = { a, lat, width: foot.width, depth: foot.depth };

      if (onStreetAngle(candidate.a, side, streetClearance)) continue;
      if (!validLatForCity(candidate)) continue;
      if (!overlapsPlaced(candidate, placed)) return candidate;

      if (!best || candidateScore(candidate, placed) > candidateScore(best, placed)) best = candidate;
    }

    // If the block is too crowded, skip this large building rather than allowing visible intersections.
    return null;
  }

  function scaledOpts(opts, opacity) {
    return Object.assign({}, opts, {
      drips: false,
      winScale: Math.max(0.48, (opts.winScale || 1) * 0.82),
      maxRows: Math.max(2, Math.min(opts.maxRows || 4, 4)),
      opacity: opacity || opts.opacity || 1
    });
  }

  for (const side of [-1, 1]) {
    const placed = [];
    for (const layer of layers) {
      for (let i = 0; i < layer.count; i++) {
        const seed = layer.seedOffset + i * 2 + (side > 0 ? 0 : 1);
        let w = layer.wMin + rnd(seed, 5) * layer.wVar;
        let h = layer.hMin + rnd(seed, 7) * layer.hVar;
        let d = layer.dMin + rnd(seed, 9) * layer.dVar;
        let melt = layer.meltMin + rnd(seed, 11) * layer.meltVar;
        const depth = (layer.name === 'front' || layer.name === 'infill') ? 0 : layer.name === 'mid' ? 1 : 2;
        let opts = layer.opts;
        let slot = citySlot(layer, side, i, seed, w, d, melt, depth, placed);

        // Keep the skyline full, but use compact filler buildings when a normal footprint would collide.
        if (!slot) {
          w *= 0.58;
          h *= 0.72;
          d *= 0.58;
          melt *= 0.75;
          opts = scaledOpts(layer.opts, layer.name === 'front' ? 0.96 : 0.88);
          slot = citySlot(layer, side, i + GRID_BLOCKS, seed + 503, w, d, melt, depth, placed);
        }

        if (!slot) continue;
        placed.push(slot);
        createCityBuilding({ side, seed, a: slot.a, w, h, d, melt, lat: slot.lat, depth, opts, dripGeo });
      }
    }
  }
}

// ---------- lo-fi road sign ----------
{
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#080420';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#e840ff';
  g.lineWidth = 7;
  g.strokeRect(5, 5, 246, 246);
  g.fillStyle = '#ff52ff';
  g.font = 'bold 66px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('LO-FI', 128, 86);
  g.font = '58px serif';
  g.fillStyle = '#ffe84f';
  g.fillText('🐱', 80, 172);
  g.fillStyle = '#ff52ff';
  g.font = 'bold 54px serif';
  g.fillText('♪', 182, 172);
  const signTex = new THREE.CanvasTexture(cv);
  signTex.colorSpace = THREE.SRGBColorSpace;

  const signGrp = new THREE.Group();
  const postMat = new THREE.MeshBasicMaterial({ color: 0x9999bb });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 8), postMat);
  post.position.y = 1.7;
  signGrp.add(post);
  const panelMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), panelMat);
  panel.position.y = 4.0;
  signGrp.add(panel);
  // bright neon frame so bloom picks it up
  const frameMat = new THREE.MeshBasicMaterial({ color: 0xe840ff, transparent: true, opacity: 0.55 });
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 2.35), frameMat);
  frame.position.set(0, 4.0, -0.02);
  signGrp.add(frame);

  onPlanet(signGrp, -0.15, -(roadHalfAng + 0.24), 0);
}

// ---------- floating wobble blobs ----------
const blobs = [];
{
  const geo = new THREE.SphereGeometry(1, 12, 10);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, fog: false });
    const b = new THREE.Mesh(geo, m);
    b.scale.set(2.2 + rnd(i, 21) * 2.5, 0.9 + rnd(i, 23) * 1.1, 1);
    b.position.set(-40 + rnd(i, 25) * 80, 16 + rnd(i, 27) * 18, -70 - rnd(i, 29) * 20);
    scene.add(b);
    blobs.push({ b, m, i });
  }
}

// ---------- selected character ----------
const characterController = createCharacter(options.character, rnd);
scene.add(characterController.group);

// ---------- floating music notes ----------
function noteTexture(ch) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 48px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.strokeStyle = '#000'; g.lineWidth = 5; g.strokeText(ch, 32, 36);
  g.fillStyle = '#fff'; g.fillText(ch, 32, 36);
  return new THREE.CanvasTexture(c);
}
const notes = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.SpriteMaterial({ map: noteTexture(i % 2 ? '♪' : '♫'), transparent: true, fog: false });
  const s = new THREE.Sprite(m);
  s.scale.set(0.55, 0.55, 1);
  scene.add(s);
  notes.push({ s, m, i });
}

// ---------- animation ----------
let camZrot = 0;
let last = performance.now() / 1000;
const _c = new THREE.Color();

// --- the slow, relaxing drip cycle: gather -> bob, bob, bob -> release -> fall -> splat -> reform ---
function animateDrips(t) {
  for (const dp of drips) {
    const u = ((t / dp.period) + dp.phase) % 1;
    const m = dp.mesh, baseR = m.userData.baseR;
    let y, sx, sy, op = 1;
    if (u < 0.72) {
      // bobbing: three lazy dips, each reaching a little lower, like it can't quite let go
      const k = u / 0.72;
      const dip = 0.5 - 0.5 * Math.cos(k * 3 * TAU);     // 3 bobs
      const reach = 0.12 + 0.55 * k * k;                  // each bob stretches further
      y = dp.roofY - dip * reach;
      const grow = 0.55 + 0.45 * k;                       // the drop swells as it gathers
      sx = grow * (1 - 0.18 * dip);
      sy = grow * (1 + 0.45 * dip);                       // stretches as it dips
    } else if (u < 0.92) {
      // release: it finally lets go
      const f = (u - 0.72) / 0.20;
      y = dp.roofY - (dp.roofY - dp.fallTo) * f * f;      // ease-in fall
      sx = 0.78; sy = 1.65;
    } else {
      // splat at the sidewalk, fading away to reform up top
      const f = (u - 0.92) / 0.08;
      y = dp.fallTo;
      sx = 1.4 + f * 0.6; sy = 0.32;
      op = 1 - f;
    }
    m.position.y = y;
    m.scale.set(baseR * sx, baseR * sy, baseR * sx);
    dp.mat.opacity = op;
    // drop wears its building's color, brighter so it reads against the dark facade
    dp.mat.color.copy(dp.link.color).offsetHSL(0.03, 0.08, 0.28);
  }
}

// --- 90s line boil: the world's ink re-registers a few times a second ---
let lastBoilIdx = -1;
function boilWorld(boilIdx) {
  for (const b of buildings) {
    b.grp.quaternion.copy(b.baseQ);
    b.grp.rotateZ((rnd(boilIdx * 7 + b.seed, 71) - 0.5) * 0.022);
    b.grp.rotateX((rnd(boilIdx * 7 + b.seed, 73) - 0.5) * 0.014);
    b.hull.scale.setScalar(1.05 + rnd(boilIdx * 7 + b.seed, 75) * 0.025);
  }
}

let lastFrameIdx = -1;
let disposed = false;
let rafId = 0;
function frame() {
  if (disposed) return;
  const now = performance.now() / 1000;
  const dt = Math.min(now - last, 0.05);
  last = now;
  const t = now;

  // ---- WORLD: smooth sphere roll (same surface speed as before) ----
  if (!reduceMotion) camZrot += (WALK_SPEED / R) * dt;
  planet.rotation.x = camZrot;

  paintSky(t);
  paintSun(t);
  sunMesh.position.y = 9 + Math.sin(t * BEAT * TAU / 8) * 0.6;

  // Scene breathes slowly within the warm 80s/90s sunset palette
  const breathe = Math.sin(t * 0.07) * 0.5 + 0.5;  // 45 s cycle, 0→1

  // Fog: warm purple, never leaves the sunset zone
  scene.fog.color.setHSL(0.728 + breathe * 0.018, 0.55, 0.11);

  // Buildings: fixed 80s/90s hue slots — purple, teal, indigo, pink-violet, navy, violet
  // Purple/indigo/violet range — matches the concept's dark cityscape palette
  const BLDG_HUES = [0.718, 0.688, 0.660, 0.760, 0.700, 0.730, 0.750, 0.698, 0.672];
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const bh = BLDG_HUES[b.seed % BLDG_HUES.length] + Math.sin(t * 0.12 + b.seed * 0.6) * 0.018;
    const bl = (b.lightBase ?? 0.32) * 0.80 + 0.03 * Math.sin(t * 2.2 + b.seed * 1.7);
    b.mat.color.setHSL(bh, 0.72, bl);
    for (let wj = 0; wj < b.winMats.length; wj++) {
      const phw = rnd(b.seed * 13 + wj, 61) * TAU;
      const glow = 0.5 + 0.5 * Math.sin(t * 2.6 + phw);
      // Warm amber window light — subtle, some rooms lit, some dark
      b.winMats[wj].color.setHSL(0.10 + glow * 0.04, 0.80, 0.55 + glow * 0.18);
      b.winMats[wj].opacity = 0.20 + glow * 0.45;
    }
  }

  // Road markings: warm cream/white — not rainbow
  for (let i = 0; i < dashMats.length; i++) {
    dashMats[i].color.setHSL(0.13, 0.35, 0.88);
  }
  for (let i = 0; i < stripMats.length; i++) {
    stripMats[i].color.setHSL(0.12, 0.25, 0.90);
  }
  for (let i = 0; i < crosswalkMats.length; i++) {
    crosswalkMats[i].color.setHSL(0.12, 0.25, 0.90);
  }

  // Cloud blobs: warm lavender tones
  const CLOUD_HUES = [0.720, 0.748, 0.680, 0.770, 0.700, 0.735, 0.760, 0.690];
  for (const bl of blobs) {
    bl.b.position.x += dt * (0.5 + bl.i * 0.12);
    if (bl.b.position.x > 45) bl.b.position.x = -45;
    bl.m.color.setHSL(CLOUD_HUES[bl.i % CLOUD_HUES.length], 0.52, 0.68 + breathe * 0.10);
  }

  // Music notes: pink, gold, purple — always warm
  const NOTE_HUES = [0.860, 0.120, 0.720];
  for (const n of notes) {
    const life = (t * 0.45 + n.i / 3) % 1;
    const side = n.i % 2 ? 1 : -1;
    n.s.position.set(side * (1.1 + life * 0.9 + Math.sin(t * 2 + n.i * 2) * 0.15), 2.5 + life * 1.9, 0.4);
    n.m.opacity = 1 - life;
    n.m.color.setHSL(NOTE_HUES[n.i % 3], 0.95, 0.80);
  }

  // drips ride the smooth clock — slow, hypnotic, never rushed
  if (!reduceMotion) animateDrips(t);

  // 90s ink boil on its own gentle clock
  if (!reduceMotion) {
    const boilIdx = Math.floor(t * BOIL_FPS);
    if (boilIdx !== lastBoilIdx) {
      lastBoilIdx = boilIdx;
      boilWorld(boilIdx);
    }
  }

  // ---- CHARACTER: held stop-motion poses ----
  if (!reduceMotion) {
    const frameIdx = Math.floor(t * CHAR_FPS);
    if (frameIdx !== lastFrameIdx) {
      lastFrameIdx = frameIdx;
      characterController.update(frameIdx / CHAR_FPS, frameIdx);
    }
  } else {
    characterController.update(0, 0);
  }

  camera.fov = 95 + (reduceMotion ? 0 : Math.sin(t * BEAT * TAU / 8) * 1.6);
  camera.updateProjectionMatrix();

  composer.render();
  if (!disposed) rafId = requestAnimationFrame(frame);
}
rafId = requestAnimationFrame(frame);

return {
  renderer,
  scene,
  camera,
  destroy() {
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    characterController.destroy();
    composer.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
  }
};

}
