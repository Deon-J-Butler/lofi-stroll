import * as THREE from 'three';
import type { CharacterDefinition } from '../registry/types';
import { createOrientationGizmo } from '../debug/orientationGizmo';
import type { CharacterController, Rng } from './controller';

/**
 * A flying superhero — designed for MetroCity, swappable into any scene.
 *
 * A procedural, jointed character (same philosophy as the retro-kid walker) held
 * in a classic forward-leaning flight pose: one fist punched ahead, the other
 * trailing, legs streamed back together, head lifted toward the skyline, cape and
 * curly hair billowing back toward the camera. Instead of a walk cycle it runs a
 * flight idle — a hovering bob, banking sway, cape/hair wind, rushing speed lines,
 * and a soft power aura.
 *
 * She is a Black woman with voluminous curly hair; the costume is a pink colorway
 * (magenta suit, deeper plum boots/gloves, light-pink trim) with a starred cape.
 *
 * Built facing -Z (back to the camera, flying away down the road). The figure
 * floats: there are no feet on the ground, so it uses no step-glow rig — just a
 * faint drifting ground shadow far below to sell the altitude.
 *
 * Joint hierarchy:
 *   group (scene root, static — ground shadow lives here so it stays on the road)
 *   └ flight (hover bob + banking sway + speed lines + aura)
 *     └ body (yaw + scale + forward flight pitch)
 *       └ pelvis ── hips ── trailing bent legs ── pointed boots
 *         └ spine ── torso (suit + belt)
 *           ├ shoulders ── arms ── fists (one leading, one trailing)
 *           ├ neck ── head ── curly hair (swept back, fluttering)
 *           └ capePivot ── billowing starred cape
 */

// ---- pink-forward palette + deep complexion ----
const INK = 0x140310;
const SKIN = 0x5d3a26; // rich deep brown
const SKIN_SHADOW = 0x4a2d1d;
const SUIT = 0xe23f93; // vivid magenta-pink (primary)
const SUIT_DARK = 0x5a1640; // deep plum (accents / boots / gloves)
const SUIT_TRIM = 0xffc6e4; // light pink trim
const BELT = 0xf2c94c; // small gold pop
const HAIR = 0x150d0a; // near-black curls
const HAIR_HI = 0x35211a; // faint curl highlight
const CAPE = 0xc81f6e; // deep rose cape
const AURA = 0xff7ec8; // pink power glow

// ---- skeleton dimensions (world units, before preset scale). Heroic, slim. ----
const HIP_X = 0.16;
const THIGH_LEN = 0.62;
const CALF_LEN = 0.56;
const SPINE_LEN = 0.55; // pelvis pivot -> chest
const SHOULDER_X = 0.33;
const SHOULDER_Y = 0.6; // above pelvis
const UPPER_ARM = 0.42;
const FOREARM = 0.4;
const NECK_Y = 0.74; // above pelvis
const HEAD_R = 0.34;
const CAPE_W = 1.34;
const CAPE_LEN = 2.5;

// ---- flight tuning ----
const HOVER_Y = 3.35; // body lift above the lane
const PITCH = -0.98; // forward flight lean (negative tips the head down-road, -Z)

function capeTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 384;
  const g = cv.getContext('2d')!;
  // pink field with a soft vertical sheen
  const grad = g.createLinearGradient(0, 0, 0, 384);
  grad.addColorStop(0, '#d8327a');
  grad.addColorStop(0.5, '#c81f6e');
  grad.addColorStop(1, '#9c1453');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 384);
  // centered side sheen
  const sheen = g.createLinearGradient(0, 0, 256, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,190,224,0.32)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, 256, 384);
  // five-point star emblem, upper-center
  const cx = 128;
  const cy = 150;
  const outer = 64;
  const inner = 26;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
  g.fillStyle = '#fff0f7';
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#f2c94c';
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFlyingHero(character: CharacterDefinition, rnd: Rng): CharacterController {
  const scale = character.scale ?? 1;
  const baseYaw = character.rotationY ?? 0;
  const offset = character.position ?? { x: 0, y: 0, z: 0 };
  const wind = character.walk?.windStrength ?? 1;
  const bobAmt = character.walk?.bobAmount ?? 0.12;
  const hoverHz = character.walk?.strideHz ?? 0.5;

  const group = new THREE.Group();
  group.position.set(offset.x, offset.y, offset.z);
  if (character.debug) group.add(createOrientationGizmo());

  // flight: hover bob + bank. Speed lines and aura ride here (axis-aligned to the
  // flight direction) rather than on the pitched body.
  const flight = new THREE.Group();
  flight.position.y = HOVER_Y;
  group.add(flight);

  const body = new THREE.Group();
  body.rotation.y = baseYaw;
  body.rotation.x = PITCH;
  body.scale.setScalar(scale);
  flight.add(body);

  // ---- cached materials / outline hulls ----
  const disposables: Array<{ dispose: () => void }> = [];
  const matCache = new Map<number, THREE.MeshToonMaterial>();
  function toon(color: number): THREE.MeshToonMaterial {
    let m = matCache.get(color);
    if (!m) {
      m = new THREE.MeshToonMaterial({ color });
      matCache.set(color, m);
      disposables.push(m);
    }
    return m;
  }
  const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  disposables.push(outlineMat);

  const hulls: Array<{ mesh: THREE.Mesh; base: number }> = [];
  function ink(target: THREE.Mesh, hullScale = 1.06) {
    const hull = new THREE.Mesh(target.geometry, outlineMat);
    hull.scale.setScalar(hullScale);
    target.add(hull);
    hulls.push({ mesh: hull, base: hullScale });
  }
  function mesh(geo: THREE.BufferGeometry, color: number, outlined = false, hullScale = 1.06): THREE.Mesh {
    disposables.push(geo);
    const m = new THREE.Mesh(geo, toon(color));
    if (outlined) ink(m, hullScale);
    return m;
  }
  const capsule = (r: number, len: number, color: number, outlined = false) =>
    mesh(new THREE.CapsuleGeometry(r, len, 4, 12), color, outlined);

  // ---- pelvis (body origin) ----
  const pelvis = new THREE.Group();
  body.add(pelvis);

  const hips = mesh(new THREE.BoxGeometry(0.42, 0.26, 0.32), SUIT_DARK, true, 1.05);
  pelvis.add(hips);
  // gold belt line
  const belt = mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.08, 14), BELT);
  belt.scale.set(1, 1, 0.78);
  belt.position.y = 0.1;
  pelvis.add(belt);

  // ---- legs: streamed back together, slight bend, pointed toes ----
  type Leg = { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group };
  function buildLeg(side: -1 | 1): Leg {
    const hip = new THREE.Group();
    hip.position.set(side * HIP_X, -0.12, 0);
    pelvis.add(hip);

    const thigh = capsule(0.135, THIGH_LEN - 0.18, SUIT, true);
    thigh.position.y = -THIGH_LEN / 2;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -THIGH_LEN;
    hip.add(knee);

    const calf = capsule(0.115, CALF_LEN - 0.16, SUIT, true);
    calf.position.y = -CALF_LEN / 2;
    knee.add(calf);

    // plum boot with a pink cuff
    const ankle = new THREE.Group();
    ankle.position.y = -CALF_LEN;
    knee.add(ankle);
    const cuff = mesh(new THREE.CylinderGeometry(0.14, 0.135, 0.12, 12), SUIT_TRIM, true, 1.05);
    cuff.position.y = 0.02;
    ankle.add(cuff);
    const boot = capsule(0.13, 0.16, SUIT_DARK, true);
    boot.position.y = -0.16;
    ankle.add(boot);
    const toe = mesh(new THREE.SphereGeometry(0.13, 12, 9), SUIT_DARK, true, 1.08);
    toe.scale.set(0.92, 0.78, 1.3);
    toe.position.set(0, -0.28, -0.08);
    ankle.add(toe);

    return { hip, knee, ankle };
  }
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  // ---- spine / torso ----
  const spine = new THREE.Group();
  spine.position.y = 0.08;
  pelvis.add(spine);

  const torso = mesh(new THREE.CapsuleGeometry(0.27, SPINE_LEN - 0.18, 5, 14), SUIT, true);
  torso.scale.z = 0.82;
  torso.position.y = SPINE_LEN / 2 + 0.04;
  spine.add(torso);
  // chest emblem hint (front-facing — a deeper plum chevron under the suit tone)
  const chestV = mesh(new THREE.ConeGeometry(0.2, 0.26, 3), SUIT_TRIM);
  chestV.rotation.x = Math.PI;
  chestV.position.set(0, SPINE_LEN - 0.02, -0.22);
  spine.add(chestV);

  // ---- arms ----
  type Arm = { shoulder: THREE.Group; elbow: THREE.Group };
  function buildArm(side: -1 | 1): Arm {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * SHOULDER_X, SHOULDER_Y, 0);
    spine.add(shoulder);

    const cap = mesh(new THREE.SphereGeometry(0.15, 12, 9), SUIT, true, 1.05);
    shoulder.add(cap);
    const upper = capsule(0.1, UPPER_ARM - 0.12, SUIT, true);
    upper.position.y = -UPPER_ARM / 2;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -UPPER_ARM;
    shoulder.add(elbow);
    const forearm = capsule(0.088, FOREARM - 0.12, SUIT, true);
    forearm.position.y = -FOREARM / 2;
    elbow.add(forearm);
    // plum glove with pink cuff
    const gloveCuff = mesh(new THREE.CylinderGeometry(0.095, 0.1, 0.07, 12), SUIT_TRIM, true, 1.04);
    gloveCuff.position.y = -FOREARM + 0.04;
    elbow.add(gloveCuff);
    const fist = mesh(new THREE.SphereGeometry(0.105, 12, 9), SUIT_DARK, true, 1.07);
    fist.position.y = -FOREARM - 0.04;
    elbow.add(fist);

    return { shoulder, elbow };
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);

  // ---- neck / head ----
  const neck = new THREE.Group();
  neck.position.y = NECK_Y;
  spine.add(neck);
  const neckMesh = mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.12, 10), SKIN);
  neckMesh.position.y = 0.01;
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.y = 0.28;
  neck.add(head);
  const skull = mesh(new THREE.SphereGeometry(HEAD_R, 20, 16), SKIN, true, 1.05);
  skull.scale.set(0.96, 1.04, 0.98);
  head.add(skull);
  // small face hint (mostly away from camera): determined brow + eyes
  const browMat = toon(SKIN_SHADOW);
  for (const sx of [-1, 1] as const) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0x20140d }));
    eye.position.set(sx * 0.13, 0.02, -HEAD_R * 0.92);
    eye.scale.set(1, 0.7, 0.5);
    head.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.04), browMat);
    brow.position.set(sx * 0.13, 0.1, -HEAD_R * 0.95);
    brow.rotation.z = sx * 0.18;
    head.add(brow);
  }

  // ---- curly hair: a voluminous rounded crown of curls, swept back ----
  // A subset of "loose" outer curls flutters in the flight wind.
  const hair = new THREE.Group();
  head.add(hair);
  const curlGeo = new THREE.IcosahedronGeometry(0.13, 0);
  disposables.push(curlGeo);
  const looseCurls: Array<{ mesh: THREE.Mesh; base: THREE.Vector3; phase: number; amp: number }> = [];
  const curlCount = 46;
  for (let i = 0; i < curlCount; i++) {
    // sample the upper-back hemisphere of the scalp, biased backward (+Z) and up
    const u = rnd(i, 11);
    const v = rnd(i, 12);
    const az = u * Math.PI * 2;
    const el = 0.12 + v * 1.15; // elevation from equator up over the crown
    const back = 0.5 + 0.5 * Math.cos(az); // 1 at the back (+Z), 0 at the face (-Z)
    const r = HEAD_R * (0.96 + rnd(i, 13) * 0.22);
    const x = Math.sin(el) * Math.sin(az) * r;
    const y = Math.cos(el) * r * 1.02 + 0.04;
    let z = Math.sin(el) * (-Math.cos(az)) * r; // -Z faceward, +Z back
    // skip the lower face so it reads as a hairline, keep the back full
    if (z < -HEAD_R * 0.45 && y < HEAD_R * 0.5) continue;
    // sweep curls backward with the wind
    z += back * 0.12;
    const s = 0.62 + rnd(i, 14) * 0.95;
    const col = rnd(i, 15) > 0.78 ? HAIR_HI : HAIR;
    const curl = new THREE.Mesh(curlGeo, toon(col));
    curl.position.set(x, y, z);
    curl.scale.setScalar(s);
    hair.add(curl);
    // outer/back curls (high & rearward) are the loose, fluttering ones
    if (back > 0.55 && (y > HEAD_R * 0.4 || z > HEAD_R * 0.5)) {
      looseCurls.push({ mesh: curl, base: curl.position.clone(), phase: rnd(i, 16) * Math.PI * 2, amp: 0.5 + rnd(i, 17) * 0.7 });
    }
  }
  // a few trailing curls streaming off the back of the head
  for (let i = 0; i < 7; i++) {
    const s = 0.7 + rnd(i, 21) * 0.7;
    const curl = new THREE.Mesh(curlGeo, toon(rnd(i, 22) > 0.7 ? HAIR_HI : HAIR));
    const base = new THREE.Vector3(
      (rnd(i, 23) - 0.5) * 0.42,
      HEAD_R * (0.35 + rnd(i, 24) * 0.55),
      HEAD_R * 0.7 + i * 0.07
    );
    curl.position.copy(base);
    curl.scale.setScalar(s);
    hair.add(curl);
    looseCurls.push({ mesh: curl, base: base.clone(), phase: rnd(i, 25) * Math.PI * 2, amp: 0.9 + rnd(i, 26) * 0.9 });
  }

  // ---- cape: a billowing starred panel pinned at the upper back ----
  const capePivot = new THREE.Group();
  capePivot.position.set(0, SHOULDER_Y + 0.12, 0.16); // upper back, behind the shoulders
  capePivot.rotation.x = 0.95; // lays the cape well back so it streams over (not under) the trailing legs
  spine.add(capePivot);

  const capeTex = capeTexture();
  disposables.push(capeTex);
  const capeMat = new THREE.MeshToonMaterial({ map: capeTex, side: THREE.DoubleSide });
  disposables.push(capeMat);
  const capeGeo = new THREE.PlaneGeometry(CAPE_W, CAPE_LEN, 7, 12);
  disposables.push(capeGeo);
  capeGeo.translate(0, -CAPE_LEN / 2, 0); // pin the top edge at the pivot
  {
    const pos = capeGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const yn = Math.max(0, -y / CAPE_LEN);
      const flare = 1 + 0.34 * yn; // widens toward the hem
      pos.setXYZ(i, x * flare, y, 0.34 * Math.pow(yn, 1.2)); // initial backward curl, draping over the legs
    }
    capeGeo.computeVertexNormals();
  }
  const capeBase = new Float32Array((capeGeo.attributes.position as THREE.BufferAttribute).array);
  const cape = new THREE.Mesh(capeGeo, capeMat);
  const capeHull = new THREE.Mesh(capeGeo, outlineMat);
  capeHull.scale.setScalar(1.04);
  cape.add(capeHull);
  capePivot.add(cape);
  // a collar so the cape reads as attached, not floating
  const collar = mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16, Math.PI * 1.2), CAPE, true, 1.05);
  collar.rotation.x = -0.5;
  collar.rotation.y = Math.PI;
  collar.position.set(0, SHOULDER_Y + 0.18, 0.02);
  spine.add(collar);

  // ===================================================================
  //  FLIGHT FX — speed lines, power aura, ground shadow
  // ===================================================================
  // Speed lines: thin streaks that rush past from front (-Z) to camera (+Z),
  // flickering, to read as fast forward flight. Additive, axis-aligned to motion.
  const streakGeo = new THREE.PlaneGeometry(0.07, 1, 1, 1);
  disposables.push(streakGeo);
  type Streak = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; offX: number; offY: number; len: number; phase: number; speed: number };
  const streaks: Streak[] = [];
  const STREAK_N = 16;
  for (let i = 0; i < STREAK_N; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: rnd(i, 31) > 0.5 ? 0xffffff : AURA,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    disposables.push(mat);
    const m = new THREE.Mesh(streakGeo, mat);
    m.rotation.x = Math.PI / 2; // lay the streak flat along Z (the flight axis)
    const ring = rnd(i, 32);
    const rad = 0.45 + rnd(i, 33) * 1.25;
    const ang = ring * Math.PI * 2;
    const offX = Math.cos(ang) * rad;
    const offY = 0.35 + Math.sin(ang) * rad * 0.8;
    const len = 1.1 + rnd(i, 34) * 1.8;
    m.scale.y = len;
    m.position.set(offX, offY, 0);
    flight.add(m);
    streaks.push({ mesh: m, mat, offX, offY, len, phase: rnd(i, 35), speed: 0.85 + rnd(i, 36) * 0.85 });
  }

  // Power aura: a soft pink glow behind/around the hero, gently pulsing.
  const auraCv = document.createElement('canvas');
  auraCv.width = 128;
  auraCv.height = 128;
  {
    const g = auraCv.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 10, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,158,212,0.62)');
    grd.addColorStop(0.45, 'rgba(255,110,190,0.34)');
    grd.addColorStop(1, 'rgba(255,110,190,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const auraTex = new THREE.CanvasTexture(auraCv);
  disposables.push(auraTex);
  const auraMat = new THREE.SpriteMaterial({ map: auraTex, transparent: true, opacity: 0.5, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  disposables.push(auraMat);
  const aura = new THREE.Sprite(auraMat);
  aura.scale.set(3.2, 3.2, 1);
  aura.position.set(0, 0.4, 0.5);
  flight.add(aura);

  // a pink rim light so the suit catches the "power" color
  const rim = new THREE.PointLight(AURA, 0.6, 6);
  rim.position.set(0, 0.6, 1.0);
  flight.add(rim);

  // Ground shadow: stays on the road (in `group`, not `flight`) and only tracks the
  // hero's lateral drift — small and faint because she's high up.
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x05030d, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  disposables.push(shadowMat);
  const shadowGeo = new THREE.PlaneGeometry(1.5, 0.7);
  disposables.push(shadowGeo);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.02, 0.1);
  shadow.renderOrder = 70;
  group.add(shadow);

  // ===================================================================
  //  RGB NEON STROBE — driven by the scene's RGB toggle via setGradient()
  // ===================================================================
  // The suit, cape, belt and aura glow through a neon hue cycle, strobing on a
  // fast pulse. Driven by emissive so the base pink reads through and bloom catches it.
  const strobeMats = [toon(SUIT), toon(SUIT_DARK), toon(SUIT_TRIM), toon(BELT), capeMat];
  const _strobe = new THREE.Color();
  let rgbOn = false;
  function setGradient(on: boolean) {
    rgbOn = on;
    if (!on) {
      for (const m of strobeMats) {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }
      auraMat.color.setHex(0xffffff);
    }
  }

  // ===================================================================
  //  POSE — the held flight silhouette
  // ===================================================================
  // legs: streamed back together with the feet kicked up behind (knees bent), so
  // they tuck under the billowing cape instead of poking out in front of it.
  legL.hip.rotation.set(-0.04, 0, 0.05);
  legR.hip.rotation.set(0.06, 0, -0.05);
  legL.knee.rotation.x = -0.92;
  legR.knee.rotation.x = -1.05;
  legL.ankle.rotation.x = 0.32;
  legR.ankle.rotation.x = 0.3;

  // arms: right fist punched forward (down-road, -Z), left arm trailing back.
  armR.shoulder.rotation.set(1.95, 0, 0.12); // up & forward into the lead
  armR.elbow.rotation.x = -0.15;
  armL.shoulder.rotation.set(-0.85, 0, -0.32); // swept back along the side
  armL.elbow.rotation.x = -0.45;

  // head lifted to look ahead down the road
  head.rotation.x = -0.62;

  // ---- animation state ----
  const _shadowWorld = new THREE.Vector3();

  function update(qt: number, frameIdx: number) {
    const t = qt;
    const jitter = (salt: number) => rnd(frameIdx, salt) - 0.5;

    // hover bob + gentle banking sway
    flight.position.y = HOVER_Y + Math.sin(t * hoverHz * Math.PI * 2) * bobAmt + jitter(51) * 0.01;
    flight.position.x = Math.sin(t * hoverHz * Math.PI * 2 * 0.6 + 1.1) * 0.07 + jitter(52) * 0.01;
    body.rotation.z = Math.sin(t * hoverHz * Math.PI * 2 * 0.5) * 0.06 * wind + jitter(53) * 0.008;
    body.rotation.x = PITCH + Math.sin(t * hoverHz * Math.PI * 2 * 0.7 + 0.5) * 0.03;
    body.rotation.y = baseYaw + Math.sin(t * 0.6) * 0.04;

    // alive limbs — small drift so the held pose breathes
    armR.shoulder.rotation.z = 0.12 + Math.sin(t * 1.7) * 0.05;
    armL.shoulder.rotation.z = -0.32 - Math.sin(t * 1.5 + 1.0) * 0.05;
    legL.ankle.rotation.x = 0.45 + Math.sin(t * 2.0) * 0.06;
    legR.ankle.rotation.x = 0.4 + Math.sin(t * 2.0 + 0.7) * 0.06;
    head.rotation.z = Math.sin(t * 1.2) * 0.04;

    // cape billow — strong, outward-and-up, intensified at the hem
    const cw = wind * (1.1 + 0.25 * Math.sin(t * 1.3));
    capePivot.rotation.x = 0.5 + Math.sin(t * 1.1) * 0.12 * cw;
    capePivot.rotation.z = Math.sin(t * 0.9 + 0.6) * 0.1 * cw;
    const cpos = capeGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cpos.count; i++) {
      const j = i * 3;
      const bx = capeBase[j];
      const by = capeBase[j + 1];
      const bz = capeBase[j + 2];
      const yn = Math.max(0, -by / CAPE_LEN);
      const w = Math.pow(yn, 1.25) * cw;
      const wave = Math.sin(t * 3.0 + yn * 4.2 + bx * 2.0);
      const flap = 0.5 + 0.5 * wave;
      cpos.setXYZ(
        i,
        bx + 0.14 * w * wave,
        by + 0.12 * w * flap, // lifts the hem as it streams
        bz + 0.42 * w * flap + 0.12 * w * (0.5 + 0.5 * Math.sin(t * 2.1 + bx))
      );
    }
    cpos.needsUpdate = true;
    capeGeo.computeVertexNormals();

    // curly hair flutter
    for (const c of looseCurls) {
      const f = Math.sin(t * 4.0 + c.phase) * c.amp * wind;
      const g = Math.sin(t * 2.7 + c.phase * 1.4) * c.amp * wind;
      c.mesh.position.set(c.base.x + g * 0.025, c.base.y + f * 0.02, c.base.z + (0.5 + 0.5 * f) * 0.05 + g * 0.02);
    }

    // speed lines: scroll from -Z (ahead) to +Z (camera), fading in & out
    for (const s of streaks) {
      const p = (t * s.speed + s.phase) % 1;
      const z = -2.6 + p * 5.2; // sweep past the body toward the camera
      s.mesh.position.set(s.offX, s.offY, z);
      // brightest as it whips past the torso, gone at the ends
      const fade = Math.sin(p * Math.PI);
      s.mat.opacity = Math.pow(fade, 1.4) * 0.85;
      s.mesh.scale.y = s.len * (0.7 + fade * 0.7);
    }

    // aura pulse
    auraMat.opacity = 0.34 + 0.16 * (0.5 + 0.5 * Math.sin(t * 2.4));
    const ap = 3.3 + 0.3 * Math.sin(t * 1.8);
    aura.scale.set(ap, ap, 1);
    rim.intensity = 0.6 + 0.25 * Math.sin(t * 2.4 + 1.0);

    // neon RGB strobe across the costume + cape + aura when the RGB toggle is on
    if (rgbOn) {
      for (let i = 0; i < strobeMats.length; i++) {
        const hue = (t * 0.4 + i * 0.13) % 1;
        _strobe.setHSL(hue, 1.0, 0.55);
        strobeMats[i].emissive.copy(_strobe);
        strobeMats[i].emissiveIntensity = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 10 + i * 1.3), 2);
      }
      _strobe.setHSL((t * 0.4) % 1, 1.0, 0.62);
      auraMat.color.copy(_strobe);
      rim.color.copy(_strobe);
    } else {
      rim.color.setHex(AURA);
    }

    // outline boil — same 90s ink wobble the world uses
    for (let i = 0; i < hulls.length; i++) {
      hulls[i].mesh.scale.setScalar(hulls[i].base + rnd(frameIdx * 7 + i, 75) * 0.02);
    }

    // ground shadow follows the hero's lateral position, faint & soft
    flight.getWorldPosition(_shadowWorld);
    group.worldToLocal(_shadowWorld);
    shadow.position.x = _shadowWorld.x;
    const lift = 0.5 + 0.5 * Math.sin(t * hoverHz * Math.PI * 2);
    shadowMat.opacity = 0.2 - lift * 0.07;
    shadow.scale.setScalar(1 + lift * 0.12);
  }

  function destroy() {
    for (const d of disposables) d.dispose();
  }

  // prime one frame so the held pose is correct before the first tick
  update(0, 0);

  return { group, update, setGradient, destroy };
}
