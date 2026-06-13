// @ts-nocheck
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createCharacter } from '../characters';
import { createCameraRig } from './common/cameraRig';
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
const BPM = 140;
const BEAT = BPM / 60;
const CHAR_FPS = 30;            // stop-motion clock for the character
const BOIL_FPS = 3;            // 90s line-boil clock for the world's inked outlines
const WALK_SPEED = 1.75 * (options.character.speedScale ?? 1);  // slow lofi stroll pace (a flyer nudges this up)

// ---------- renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

let gradientOn = false;
let moonOn = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1a0b33, 42, 115);

const camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 3.4, 7.6);
camera.lookAt(0, 1.9, -10);
const cameraRig = createCameraRig(camera);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.38,   // very soft glow — washed-out lofi look
  0.30,   // radius
  0.97    // high threshold — almost nothing blooms
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
const hemiLight = new THREE.HemisphereLight(0x9080b8, 0x2a1440, 0.90);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xd4b890, 0.65);
sunLight.position.set(0, 18, -40);
scene.add(sunLight);
const rim = new THREE.DirectionalLight(0x88a8c0, 0.28);
rim.position.set(6, 8, 10);
scene.add(rim);
// low point-light that follows the RGB gradient below the shoes
const gradientFootLight = new THREE.PointLight(0xffd0d8, 0, 5.5);
gradientFootLight.position.set(0, 0.35, 0);
scene.add(gradientFootLight);

// ---------- sky backdrop + celestial body ----------
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
  const breathe = Math.sin(t * 0.05) * 0.5 + 0.5;  // slower breath
  const grad = g.createLinearGradient(0, 0, 0, 256);
  if (moonOn) {
    grad.addColorStop(0,    `hsl(${228 + breathe * 5},18%,6%)`);
    grad.addColorStop(0.34, `hsl(${232 + breathe * 4},14%,10%)`);
    grad.addColorStop(0.64, `hsl(${238 + breathe * 3},11%,16%)`);
    grad.addColorStop(0.86, `hsl(${246 + breathe * 2},9%,22%)`);
    grad.addColorStop(1,    `hsl(${252 + breathe * 2},8%,28%)`);
  } else {
    grad.addColorStop(0,    `hsl(${246 + breathe * 8},32%,10%)`);    // muted deep indigo
    grad.addColorStop(0.35, `hsl(${262 + breathe * 6},28%,20%)`);    // dusty purple
    grad.addColorStop(0.62, `hsl(${285 + breathe * 5},30%,30%)`);    // faded mauve
    grad.addColorStop(0.83, `hsl(${315 + breathe * 4},32%,38%)`);    // dusty rose
    grad.addColorStop(1,    `hsl(${28 + breathe * 6},48%,48%)`);     // muted amber horizon
  }
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  skyTex.needsUpdate = true;
}

function paintSun(t) {
  const g = sunCv.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  // Faded warm corona glow
  const corona = g.createRadialGradient(128, 128, 42, 128, 128, 128);
  corona.addColorStop(0,   'hsla(38, 55%, 68%, 0.75)');
  corona.addColorStop(0.5, 'hsla(28, 45%, 55%, 0.30)');
  corona.addColorStop(1,   'hsla(24, 40%, 48%, 0)');
  g.fillStyle = corona; g.fillRect(0, 0, 256, 256);
  g.save();
  g.beginPath(); g.arc(128, 128, 96, 0, TAU); g.clip();
  // Dusty gold base
  g.fillStyle = 'hsl(38, 48%, 58%)';
  g.fillRect(0, 0, 256, 256);
  // Washed retro horizontal bands
  g.fillStyle = 'hsl(18, 42%, 44%)';
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

function paintMoon(t) {
  const g = sunCv.getContext('2d');
  g.clearRect(0, 0, 256, 256);

  const glow = g.createRadialGradient(128, 128, 46, 128, 128, 128);
  glow.addColorStop(0, 'rgba(178, 182, 188, 0.34)');
  glow.addColorStop(0.48, 'rgba(118, 124, 134, 0.16)');
  glow.addColorStop(1, 'rgba(50, 54, 64, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 256, 256);

  g.save();
  g.beginPath();
  g.arc(128, 128, 82, 0, TAU);
  g.clip();
  const base = g.createRadialGradient(104, 92, 8, 128, 128, 95);
  base.addColorStop(0, 'rgb(194, 194, 190)');
  base.addColorStop(0.46, 'rgb(158, 160, 160)');
  base.addColorStop(1, 'rgb(112, 116, 120)');
  g.fillStyle = base;
  g.fillRect(36, 36, 184, 184);

  const craters = [
    [92, 88, 15, 0.20], [148, 72, 10, 0.16], [170, 123, 18, 0.18],
    [111, 144, 22, 0.15], [82, 158, 9, 0.18], [139, 174, 12, 0.14],
    [132, 111, 7, 0.18], [180, 164, 7, 0.13]
  ];
  for (const [x, y, r, a] of craters) {
    const crater = g.createRadialGradient(x - r * 0.28, y - r * 0.28, 1, x, y, r);
    crater.addColorStop(0, `rgba(232, 232, 226, ${a * 0.45})`);
    crater.addColorStop(0.48, `rgba(86, 90, 96, ${a})`);
    crater.addColorStop(1, 'rgba(42, 46, 54, 0)');
    g.fillStyle = crater;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  g.strokeStyle = 'rgba(226, 226, 220, 0.16)';
  g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = 70 + i * 14 + Math.sin(t * 0.12 + i) * 1.2;
    g.beginPath();
    g.moveTo(62, y);
    g.bezierCurveTo(94, y - 4, 140, y + 5, 192, y - 2);
    g.stroke();
  }
  g.restore();

  sunTex.needsUpdate = true;
}

// ---------- THE PLANET: a true sphere, road on its great circle ----------
const R = 30;                                   // sphere radius — its arc bows across the frame
const STREET_COLOR = 0x251840;                    // lightened road
const SIDEWALK_COLOR = 0x4a3265;                  // lightened sidewalk/block
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
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x100820, side: THREE.BackSide });
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

addCityGridSurface();

function createCityBuilding({ side, seed, a, w, h, d, melt, lat, depth, opts }) {
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

}

{
  const layers = [
    {
      name: 'front', count: 32, seedOffset: 0, latExtra: 1.05, latJitter: 0.95, aOffset: 0.00,
      wMin: 2.45, wVar: 2.05, hMin: 4.5, hVar: 6.0, dMin: 2.45, dVar: 1.75,
      meltMin: 0.55, meltVar: 0.80,
      opts: { winScale: 1, maxRows: 7, rowSpacing: 1.7, lean: 0.045, sat: 0.86, lightBase: 0.50, hullScale: 1.058 }
    },
    {
      name: 'infill', count: 42, seedOffset: 4200, latExtra: 2.25, latJitter: 4.80, aOffset: 0.19,
      wMin: 0.95, wVar: 1.05, hMin: 2.9, hVar: 4.2, dMin: 0.90, dVar: 0.90,
      meltMin: 0.28, meltVar: 0.44,
      opts: { drips: false, winScale: 0.52, maxRows: 4, rowSpacing: 1.55, lean: 0.030, sat: 0.82, lightBase: 0.45, hullScale: 1.040, cleanWindows: true }
    },
    {
      name: 'mid', count: 38, seedOffset: 1200, latExtra: 5.15, latJitter: 1.05, aOffset: 0.47,
      wMin: 1.95, wVar: 2.35, hMin: 5.4, hVar: 7.0, dMin: 1.85, dVar: 1.35,
      meltMin: 0.38, meltVar: 0.55,
      opts: { drips: false, winScale: 0.78, maxRows: 5, rowSpacing: 1.95, lean: 0.035, sat: 0.78, lightBase: 0.43, hullScale: 1.047 }
    },
    {
      name: 'far', count: 46, seedOffset: 2600, latExtra: 9.45, latJitter: 1.45, aOffset: 0.23,
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
      const minLatGap = (candidate.width + item.width) * 0.5 + 0.42;
      const minRoadGap = (candidate.depth + item.depth) * 0.5 + 0.70;
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
    const streetClearance = CROSS_ROAD_W / 2 + foot.depth * 0.50 + 0.48;
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
        createCityBuilding({ side, seed, a: slot.a, w, h, d, melt, lat: slot.lat, depth, opts });
      }
    }
  }
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

// ---------- thin smog bands above the buildings ----------
type SmogLayer = {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  speed: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
};

const smogLayers: SmogLayer[] = [];

{
  const layerCount = 5;

  for (let i = 0; i < layerCount; i++) {
    const smogCv = document.createElement('canvas');
    smogCv.width = 1024;
    smogCv.height = 220;

    const sg = smogCv.getContext('2d')!;
    sg.clearRect(0, 0, smogCv.width, smogCv.height);

    const verticalFade = sg.createLinearGradient(0, 0, 0, smogCv.height);
    const alpha = 0.34 - i * 0.035;

    verticalFade.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
    verticalFade.addColorStop(0.20, `rgba(35, 31, 42, ${alpha * 0.42})`);
    verticalFade.addColorStop(0.48, `rgba(82, 72, 88, ${alpha})`);
    verticalFade.addColorStop(0.76, `rgba(28, 26, 34, ${alpha * 0.52})`);
    verticalFade.addColorStop(1.00, 'rgba(0, 0, 0, 0)');

    sg.fillStyle = verticalFade;
    sg.fillRect(0, 0, smogCv.width, smogCv.height);

    for (let p = 0; p < 54; p++) {
      const x = rnd(i * 1000 + p, 41) * smogCv.width;
      const y = 46 + rnd(i * 1000 + p, 43) * 118;
      const rx = 110 + rnd(i * 1000 + p, 47) * 230;
      const ry = 24 + rnd(i * 1000 + p, 53) * 54;

      const puff = sg.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      puff.addColorStop(0.00, `rgba(112, 98, 118, ${alpha * 0.42})`);
      puff.addColorStop(0.55, `rgba(54, 47, 62, ${alpha * 0.26})`);
      puff.addColorStop(1.00, 'rgba(0, 0, 0, 0)');

      sg.save();
      sg.translate(x, y);
      sg.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
      sg.fillStyle = puff;
      sg.fillRect(-Math.max(rx, ry), -Math.max(rx, ry), Math.max(rx, ry) * 2, Math.max(rx, ry) * 2);
      sg.restore();
    }

    const sideFade = sg.createLinearGradient(0, 0, smogCv.width, 0);
    sideFade.addColorStop(0.00, 'rgba(0,0,0,0)');
    sideFade.addColorStop(0.08, 'rgba(0,0,0,1)');
    sideFade.addColorStop(0.92, 'rgba(0,0,0,1)');
    sideFade.addColorStop(1.00, 'rgba(0,0,0,0)');
    sg.globalCompositeOperation = 'destination-in';
    sg.fillStyle = sideFade;
    sg.fillRect(0, 0, smogCv.width, smogCv.height);
    sg.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(smogCv);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      depthTest: true,
      fog: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending
    });

    const smogMesh = new THREE.Mesh(new THREE.PlaneGeometry(165 + i * 24, 8.2 + i * 1.2), mat);

    smogMesh.position.set(0, 7.8 + i * 1.05, -52 - i * 7);
    smogMesh.renderOrder = 3;
    smogMesh.visible = moonOn;

    scene.add(smogMesh);

    smogLayers.push({
      mesh: smogMesh,
      mat,
      speed: 0.036 + i * 0.011,
      baseX: (rnd(i, 31) - 0.5) * 16,
      baseY: smogMesh.position.y,
      baseZ: smogMesh.position.z,
      phase: rnd(i, 37) * TAU
    });
  }
}

// Music notes now travel with the retro-kid character (createRetroKidWalker),
// so they follow the lo-fi kid into every scene instead of living in the world.

// ---------- animation ----------
let camZrot = 0;
let last = performance.now() / 1000;
const _c = new THREE.Color();

const groundGradientStops = [
  new THREE.Color(0xc57984),
  new THREE.Color(0xb987a2),
  new THREE.Color(0x78a7c8),
  new THREE.Color(0x8aa4c7),
  new THREE.Color(0x86bd95),
  new THREE.Color(0xb3b778)
];

function rollingGroundColor(out, phase) {
  const p = ((phase % 1) + 1) % 1;
  const scaled = p * groundGradientStops.length;
  const idx = Math.floor(scaled) % groundGradientStops.length;
  const next = (idx + 1) % groundGradientStops.length;
  return out.lerpColors(groundGradientStops[idx], groundGradientStops[next], scaled - idx);
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
  if (moonOn) {
    paintMoon(t);
    sunMesh.position.set(-7.5, 12.5 + Math.sin(t * BEAT * TAU / 10) * 0.35, -95);
    sunMesh.scale.setScalar(0.92);
  } else {
    paintSun(t);
    sunMesh.position.set(0, 9 + Math.sin(t * BEAT * TAU / 8) * 0.6, -95);
    sunMesh.scale.setScalar(1);
  }

  // Scene breathes slowly within the warm 80s/90s sunset palette
  // const breathe = Math.sin(t * 0.07) * 0.5 + 0.5;  // 45 s cycle, 0→1

  // // Fog: dusty muted haze
  // scene.fog.color.setHSL(0.725 + breathe * 0.010, 0.22, 0.13);
  const breathe = reduceMotion ? 0.5 : 0.5 + Math.sin(t * 0.07) * 0.5;

  if (moonOn) {
    scene.fog.color.setHSL(0.64, 0.08, 0.075);
    scene.fog.near = 34;
    scene.fog.far = 108;
    hemiLight.color.setHSL(0.62, 0.14, 0.48);
    hemiLight.groundColor.setHSL(0.68, 0.18, 0.10);
    hemiLight.intensity = 0.72;
    sunLight.color.setHSL(0.13, 0.10, 0.74);
    sunLight.intensity = 0.34;
    rim.color.setHSL(0.58, 0.16, 0.62);
    rim.intensity = 0.22;
  } else {
    scene.fog.color.setHSL(0.725, 0.16, 0.10);
    scene.fog.near = 42;
    scene.fog.far = 115;
    hemiLight.color.set(0x9080b8);
    hemiLight.groundColor.set(0x2a1440);
    hemiLight.intensity = 0.90;
    sunLight.color.set(0xd4b890);
    sunLight.intensity = 0.65;
    rim.color.set(0x88a8c0);
    rim.intensity = 0.28;
  }

  // Buildings: muted, faded lofi palette — dusty purples, grayed mauve, washed indigo
  const BLDG_HUES = [0.718, 0.688, 0.660, 0.760, 0.700, 0.730, 0.750, 0.698, 0.672];
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const bh = BLDG_HUES[b.seed % BLDG_HUES.length] + Math.sin(t * 0.08 + b.seed * 0.6) * 0.010;
    const bl = (b.lightBase ?? 0.32) * 0.72 + 0.015 * Math.sin(t * 1.4 + b.seed * 1.7);
    b.mat.color.setHSL(bh, 0.28, bl);   // saturation 0.28 = washed out, faded
    for (let wj = 0; wj < b.winMats.length; wj++) {
      const phw = rnd(b.seed * 13 + wj, 61) * TAU;
      const glow = 0.5 + 0.5 * Math.sin(t * 1.8 + phw);
      // Dim warm amber — some rooms softly lit like someone's home
      b.winMats[wj].color.setHSL(0.10 + glow * 0.03, 0.45, 0.48 + glow * 0.12);
      b.winMats[wj].opacity = 0.10 + glow * 0.28;
    }
  }

  // Road markings + RGB gradient
  if (gradientOn) {
    const roll = t * 0.035;
    const groundColor = rollingGroundColor(_c, roll);
    for (let i = 0; i < dashMats.length; i++) {
      dashMats[i].color.copy(groundColor);
    }
    for (let i = 0; i < stripMats.length; i++) {
      stripMats[i].color.copy(groundColor);
    }
    for (let i = 0; i < crosswalkMats.length; i++) {
      crosswalkMats[i].color.copy(groundColor);
    }
    gradientFootLight.color.copy(groundColor);
    gradientFootLight.intensity = 0.52;
    bloomPass.strength = 0.42;
    bloomPass.threshold = 0.92;
  } else {
    // warm cream road markings
    for (let i = 0; i < dashMats.length; i++)      dashMats[i].color.setHSL(0.13, 0.35, 0.88);
    for (let i = 0; i < stripMats.length; i++)     stripMats[i].color.setHSL(0.12, 0.25, 0.90);
    for (let i = 0; i < crosswalkMats.length; i++) crosswalkMats[i].color.setHSL(0.12, 0.25, 0.90);
    gradientFootLight.intensity = Math.max(0, gradientFootLight.intensity - dt * 4);
    bloomPass.strength = 0.38;
    bloomPass.threshold = 0.97;
  }

  // Thin smog bands: slow horizontal drift above the skyline only
  for (const sl of smogLayers) {
    sl.mesh.visible = moonOn;
    if (!moonOn) continue;
    sl.mesh.position.x = sl.baseX + Math.sin(t * sl.speed + sl.phase) * 7.5;
    sl.mesh.position.y = sl.baseY + Math.sin(t * 0.038 + sl.phase) * 0.28;
    sl.mesh.position.z = sl.baseZ + Math.sin(t * 0.025 + sl.phase) * 1.2;
    sl.mat.opacity = 0.46 + 0.12 * Math.sin(t * 0.050 + sl.phase);
  }

  // Cloud blobs: very subtle, barely visible
  const CLOUD_HUES = [0.720, 0.748, 0.680, 0.770, 0.700, 0.735, 0.760, 0.690];
  for (const bl of blobs) {
    bl.b.position.x += dt * (0.25 + bl.i * 0.06);
    if (bl.b.position.x > 45) bl.b.position.x = -45;
    bl.m.color.setHSL(CLOUD_HUES[bl.i % CLOUD_HUES.length], 0.20, 0.52 + breathe * 0.06);
    bl.m.opacity = 0.08;
  }

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

  cameraRig.apply(reduceMotion ? 0 : Math.sin(t * BEAT * TAU / 8) * 1.6);

  composer.render();
  if (!disposed) rafId = requestAnimationFrame(frame);
}
rafId = requestAnimationFrame(frame);

return {
  renderer,
  scene,
  camera,
  setGradient(on: boolean) { gradientOn = on; characterController.setGradient?.(on); },
  setMoon(on: boolean) { moonOn = on; },
  setView(mode: 'default' | 'side') { cameraRig.setView(mode); },
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
