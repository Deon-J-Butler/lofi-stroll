import * as THREE from 'three';
import type { CharacterDefinition } from '../registry/types';
import { createWalkPose, defaultWalkSettings, sampleWalkPose } from '../animation/walkCycle';
import { createStepGlowRig } from './common/stepGlowRig';
import { createOrientationGizmo } from '../debug/orientationGizmo';
import type { CharacterController, Rng } from './controller';

/**
 * The custom 90s retro-kid chibi: a procedural, jointed character built from cached
 * primitives so every limb is a real pivot the walk cycle can drive.
 *
 * Built facing -Z (back to the camera) at world scale: ~2.6 units tall at scale 1,
 * deliberately stout — short thick legs, wide torso, big head sunk into the shoulders.
 *
 * Joint hierarchy:
 *   group (scene root, static — step glow lives here so it stays on the road)
 *   └ body (yaw/scale + bob/sway/jitter)
 *     └ pelvis ── shorts
 *       ├ hipL/hipR ── thigh, shorts cuff ── knee ── calf ── ankle ── sneaker
 *       └ spine ── tee torso, collar, jersey panels (wind cloth)
 *         ├ shoulderL/R ── sleeve, upper arm ── elbow ── forearm, hand
 *         └ neck ── head ── cap (backward), headphones, afro fringe
 */

// World-ink palette + 90s fit
const INK = 0x0d0618;
const SKIN = 0x96603c;
const TEE = 0xfdf6ea;
const JERSEY = 0xf2efe4;
const JERSEY_BLUE = 0x2456c4;
const CAP_RED = 0xd23b3b;
const CAP_RED_DARK = 0xa92f2f;
const DENIM = 0x3b5a8f;
const DENIM_CUFF = 0x6c8ec4;
const SNEAKER_WHITE = 0xf6f4ef;
const SNEAKER_BLUE = 0x2f6fe0;
const PHONES = 0xe9e9ee;
const PHONES_DARK = 0x2a2a32;
const HAIR = 0x1b1410;

// Skeleton dimensions (world units, before preset scale).
// Stout build: legs shortened, hips/shoulders widened, head dropped into the torso.
const PELVIS_Y = 0.83;
const HIP_X = 0.19;
const THIGH_LEN = 0.38;
const CALF_LEN = 0.33;
const SPINE_Y = 0.12; // spine pivot above pelvis
const SHOULDER_X = 0.4;
const SHOULDER_Y = 0.45; // relative to spine pivot
const UPPER_ARM_LEN = 0.26;
const FOREARM_LEN = 0.22;
const NECK_Y = 0.56; // relative to spine pivot
const HEAD_R = 0.55;
const CLOTH_LEN = 0.8; // jersey back panel drop from the yoke pin to the hem

function jerseyBackTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#f2efe4';
  g.fillRect(0, 0, 256, 256);
  // side trim
  g.fillStyle = '#2456c4';
  g.fillRect(0, 0, 18, 256);
  g.fillRect(238, 0, 18, 256);
  // hem stripe
  g.fillRect(0, 236, 256, 12);
  g.fillStyle = '#d23b3b';
  g.fillRect(0, 230, 256, 6);
  // arched name
  g.fillStyle = '#2456c4';
  g.font = 'bold 30px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('L O F I', 128, 56);
  // big number with red drop
  g.font = 'bold 120px Arial, sans-serif';
  g.fillStyle = '#d23b3b';
  g.fillText('90', 132, 178);
  g.fillStyle = '#2456c4';
  g.fillText('90', 128, 174);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function elephantPrintTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#9aa0a8';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#5f646c';
  g.lineWidth = 3;
  // cracked elephant-print squiggles, seeded so the texture is stable
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    let x = r() * 64;
    let y = r() * 64;
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      x += (r() - 0.5) * 30;
      y += (r() - 0.5) * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRetroKidWalker(character: CharacterDefinition, rnd: Rng): CharacterController {
  const walk = { ...defaultWalkSettings, ...(character.walk ?? {}) };
  const scale = character.scale ?? 1;
  const baseYaw = character.rotationY ?? 0;
  const offset = character.position ?? { x: 0, y: 0, z: 0 };

  const group = new THREE.Group();
  group.position.set(offset.x, offset.y, offset.z);

  const glowRig = createStepGlowRig(character.stepGlow);
  group.add(glowRig.group);
  if (character.debug) group.add(createOrientationGizmo());

  const body = new THREE.Group();
  body.rotation.y = baseYaw;
  body.scale.setScalar(scale);
  group.add(body);

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
  function ink(mesh: THREE.Mesh, hullScale = 1.06) {
    const hull = new THREE.Mesh(mesh.geometry, outlineMat);
    hull.scale.setScalar(hullScale);
    mesh.add(hull);
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

  // ---- pelvis + jean shorts ----
  const pelvis = new THREE.Group();
  pelvis.position.y = PELVIS_Y;
  body.add(pelvis);

  const shorts = mesh(new THREE.BoxGeometry(0.54, 0.28, 0.42), DENIM, true, 1.05);
  shorts.position.y = -0.04;
  pelvis.add(shorts);

  // ---- legs ----
  type Leg = { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group };
  function buildLeg(side: -1 | 1): Leg {
    const hip = new THREE.Group();
    hip.position.set(side * HIP_X, -0.06, 0);
    pelvis.add(hip);

    const cuff = mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.2, 10), DENIM, true, 1.08);
    cuff.position.y = -0.15;
    hip.add(cuff);
    const cuffRing = mesh(new THREE.CylinderGeometry(0.173, 0.176, 0.045, 10), DENIM_CUFF);
    cuffRing.position.y = -0.25;
    hip.add(cuffRing);

    const thigh = capsule(0.12, 0.12, SKIN, true);
    thigh.position.y = -THIGH_LEN / 2;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -THIGH_LEN;
    hip.add(knee);

    const calf = capsule(0.105, 0.13, SKIN, true);
    calf.position.y = -CALF_LEN / 2;
    knee.add(calf);

    const ankle = new THREE.Group();
    ankle.position.y = -CALF_LEN;
    knee.add(ankle);

    ankle.add(buildSneaker());
    return { hip, knee, ankle };
  }

  // True Blue-style chunky retro sneaker: white body, gray elephant-print toe/heel, blue accents.
  const elephantTex = elephantPrintTexture();
  disposables.push(elephantTex);
  const elephantMat = new THREE.MeshToonMaterial({ map: elephantTex });
  disposables.push(elephantMat);
  function buildSneaker(): THREE.Group {
    const shoe = new THREE.Group();
    shoe.position.y = -0.02;

    const sole = mesh(new THREE.BoxGeometry(0.21, 0.06, 0.4), SNEAKER_WHITE, true, 1.1);
    sole.position.set(0, -0.1, -0.06);
    shoe.add(sole);

    const upper = mesh(new THREE.BoxGeometry(0.19, 0.12, 0.3), SNEAKER_WHITE, true, 1.09);
    upper.position.set(0, -0.02, -0.04);
    shoe.add(upper);

    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), elephantMat);
    disposables.push(toe.geometry);
    toe.scale.set(0.95, 0.7, 1.25);
    toe.position.set(0, -0.06, -0.2);
    ink(toe, 1.12);
    shoe.add(toe);

    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.09), elephantMat);
    disposables.push(heel.geometry);
    heel.position.set(0, -0.04, 0.1);
    shoe.add(heel);

    const collar = mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.07, 10), SNEAKER_BLUE);
    collar.position.set(0, 0.06, 0.02);
    shoe.add(collar);

    const lace = mesh(new THREE.BoxGeometry(0.12, 0.035, 0.16), SNEAKER_BLUE);
    lace.position.set(0, 0.045, -0.1);
    lace.rotation.x = 0.5;
    shoe.add(lace);

    return shoe;
  }

  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  // ---- spine / torso ----
  const spine = new THREE.Group();
  spine.position.y = SPINE_Y;
  pelvis.add(spine);

  const torso = capsule(0.345, 0.2, TEE, true);
  torso.scale.z = 0.85;
  torso.position.y = 0.26;
  spine.add(torso);

  const collar = mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 14), JERSEY_BLUE);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.6;
  spine.add(collar);

  // ---- arms ----
  type Arm = { shoulder: THREE.Group; elbow: THREE.Group };
  function buildArm(side: -1 | 1): Arm {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * SHOULDER_X, SHOULDER_Y, 0);
    spine.add(shoulder);

    const sleeve = mesh(new THREE.CylinderGeometry(0.14, 0.155, 0.2, 10), JERSEY, true, 1.08);
    sleeve.position.y = -0.08;
    shoulder.add(sleeve);
    const sleeveTrim = mesh(new THREE.CylinderGeometry(0.158, 0.162, 0.04, 10), JERSEY_BLUE);
    sleeveTrim.position.y = -0.19;
    shoulder.add(sleeveTrim);

    const upper = capsule(0.1, 0.1, SKIN, true);
    upper.position.y = -UPPER_ARM_LEN / 2;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -UPPER_ARM_LEN;
    shoulder.add(elbow);

    const forearm = capsule(0.09, 0.09, SKIN, true);
    forearm.position.y = -FOREARM_LEN / 2;
    elbow.add(forearm);

    const hand = mesh(new THREE.SphereGeometry(0.11, 10, 8), SKIN, true, 1.1);
    hand.position.y = -FOREARM_LEN - 0.04;
    elbow.add(hand);

    return { shoulder, elbow };
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);

  // ---- head / backward cap / headphones ----
  const neck = new THREE.Group();
  neck.position.y = NECK_Y;
  spine.add(neck);

  const neckMesh = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.14, 10), SKIN);
  neckMesh.position.y = 0.02;
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.y = 0.42;
  neck.add(head);

  const skull = mesh(new THREE.SphereGeometry(HEAD_R, 22, 16), SKIN, true, 1.045);
  skull.scale.set(1.02, 0.96, 0.94);
  head.add(skull);

  // afro fringe pushing out under the cap rim: a ring of puffs across the nape and
  // temples, squeezed between the cap edge, the bill, and the headphone cushions
  // nape puffs sit low (under the tilted bill), temple puffs sit high (outside the
  // bill's width, bulging around its sides up against the rim band)
  for (const [ang, py, dist, pr] of [
    [0, -0.4, 0.46, 0.19],
    [-0.55, -0.4, 0.46, 0.17],
    [0.55, -0.38, 0.46, 0.18],
    [-0.8, -0.32, 0.45, 0.15],
    [0.8, -0.33, 0.45, 0.15],
    [-1.05, -0.22, 0.45, 0.16],
    [1.05, -0.24, 0.45, 0.16],
    [-0.3, -0.46, 0.43, 0.12],
    [0.3, -0.45, 0.43, 0.12]
  ]) {
    const puff = mesh(new THREE.SphereGeometry(pr, 10, 8), HAIR);
    puff.scale.set(1, 0.78, 0.85);
    puff.position.set(Math.sin(ang) * dist, py, Math.cos(ang) * dist);
    head.add(puff);
  }

  const cap = new THREE.Group();
  cap.position.y = 0.12;
  head.add(cap);

  // roomy crown that sits on the head instead of shrink-wrapping it: wider than the
  // skull, dropping past the equator, with a rim band where it meets the fro
  const dome = mesh(new THREE.SphereGeometry(0.62, 22, 14, 0, Math.PI * 2, 0, 1.9), CAP_RED, true, 1.04);
  dome.scale.set(1.04, 0.88, 1);
  cap.add(dome);

  const capButton = mesh(new THREE.SphereGeometry(0.07, 8, 6), CAP_RED);
  capButton.scale.y = 0.55;
  capButton.position.y = 0.54;
  cap.add(capButton);

  const capBand = mesh(new THREE.TorusGeometry(0.59, 0.05, 8, 24), CAP_RED_DARK);
  capBand.rotation.x = Math.PI / 2;
  capBand.scale.set(1.04, 1, 1);
  capBand.position.y = -0.17;
  cap.add(capBand);

  // backward bill pointing at the camera (+Z): a long flat oval whose rear half is
  // buried in the crown so it reads as sewn into the rim. Tilted well down over the
  // nape so the top face catches the above-and-behind game camera instead of
  // disappearing edge-on.
  const brim = mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.05, 18), CAP_RED, true, 1.06);
  brim.scale.set(0.72, 1, 0.95);
  brim.position.set(0, -0.12, 0.34);
  brim.rotation.x = 0.25;
  cap.add(brim);

  // snap closure sits over the forehead when the cap is backward (away from camera)
  const strap = mesh(new THREE.BoxGeometry(0.3, 0.09, 0.05), CAP_RED);
  strap.position.set(0, -0.14, -0.56);
  strap.rotation.x = 0.2;
  cap.add(strap);
  const snapGap = mesh(new THREE.BoxGeometry(0.13, 0.055, 0.055), INK);
  snapGap.position.set(0, -0.14, -0.565);
  snapGap.rotation.x = 0.2;
  cap.add(snapGap);

  // over-ear headphones: silver band resting on the cap, cushioned cups on the ears
  const band = mesh(new THREE.TorusGeometry(0.69, 0.055, 8, 20, Math.PI), PHONES, true, 1.12);
  band.position.set(0, 0.04, 0.06);
  head.add(band);

  for (const side of [-1, 1] as const) {
    const cup = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 14), PHONES, true, 1.1);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(side * 0.66, -0.04, 0.04);
    head.add(cup);
    const cushion = mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.05, 14), PHONES_DARK);
    cushion.rotation.z = Math.PI / 2;
    cushion.position.set(side * 0.58, -0.04, 0.04);
    head.add(cushion);
  }

  // ---- oversized open jersey: yoke + wind-animated back panel + hanging front panels ----
  const jerseyTex = jerseyBackTexture();
  disposables.push(jerseyTex);

  // shoulder yoke draping over the torso
  const yoke = mesh(new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, 1.5), JERSEY, true, 1.05);
  yoke.scale.set(1.06, 0.78, 0.96);
  yoke.position.y = 0.44;
  spine.add(yoke);

  // back panel: cloth pinned at the yoke, hem at the bottom of the shorts (a jersey,
  // not a cape), wrapped around the torso sides, vertex-animated wind
  const backPanelMat = new THREE.MeshToonMaterial({ map: jerseyTex, side: THREE.DoubleSide });
  disposables.push(backPanelMat);
  const clothGeo = new THREE.PlaneGeometry(0.78, CLOTH_LEN, 6, 8);
  disposables.push(clothGeo);
  clothGeo.translate(0, -CLOTH_LEN / 2, 0); // pin top edge at the pivot
  {
    const pos = clothGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const yn = Math.max(0, -y / CLOTH_LEN); // 0 at the pinned top, 1 at the hem (clamped: float32 puts the top row at ~+1e-8)
      const flare = 1 + 0.18 * yn;
      // wrap the panel around the torso so it reads as a worn shirt, not a flat card
      pos.setXYZ(i, x * flare, y, -0.16 * Math.pow((x * flare) / 0.45, 2));
    }
    clothGeo.computeVertexNormals();
  }
  const clothBase = new Float32Array((clothGeo.attributes.position as THREE.BufferAttribute).array);
  const clothPivot = new THREE.Group();
  clothPivot.position.set(0, 0.48, 0.34);
  spine.add(clothPivot);
  const backPanel = new THREE.Mesh(clothGeo, backPanelMat);
  clothPivot.add(backPanel);

  // open front panels ending above the shorts hem; mostly silhouette from behind
  const frontPanels: THREE.Group[] = [];
  for (const side of [-1, 1] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.22, 0.46, -0.28);
    pivot.rotation.y = side * 0.45; // wrapped toward the body so it doesn't read as a flat plank
    spine.add(pivot);
    const geo = new THREE.PlaneGeometry(0.3, 0.66, 1, 4);
    geo.translate(0, -0.33, 0);
    const panel = mesh(geo, JERSEY);
    (panel.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
    pivot.add(panel);
    frontPanels.push(pivot);
  }

  // ---- animation state (preallocated) ----
  const pose = createWalkPose();
  const footL = new THREE.Vector3();
  const footR = new THREE.Vector3();

  function update(qt: number, frameIdx: number) {
    sampleWalkPose(qt, walk, pose);
    const jitter = (salt: number) => (rnd(frameIdx, salt) - 0.5);

    // body root: bob, weight shift, stop-motion line jitter
    body.position.x = pose.sway + jitter(55) * 0.012;
    body.position.y = pose.bob + jitter(57) * 0.008;
    body.rotation.y = baseYaw + jitter(59) * 0.01;
    body.rotation.z = pose.spineRoll * 0.25 + jitter(61) * 0.006;

    pelvis.rotation.y = pose.pelvisYaw;
    pelvis.rotation.z = pose.pelvisRoll;

    legL.hip.rotation.x = pose.hipL;
    legR.hip.rotation.x = pose.hipR;
    legL.knee.rotation.x = -pose.kneeL;
    legR.knee.rotation.x = -pose.kneeR;
    legL.ankle.rotation.x = pose.ankleL;
    legR.ankle.rotation.x = pose.ankleR;

    spine.rotation.x = pose.spineLean;
    spine.rotation.y = pose.spineYaw;
    spine.rotation.z = pose.spineRoll;

    armL.shoulder.rotation.x = pose.shoulderL;
    armR.shoulder.rotation.x = pose.shoulderR;
    armL.shoulder.rotation.z = -0.22; // relaxed arms splayed past the jersey panel so they read from behind
    armR.shoulder.rotation.z = 0.22;
    armL.elbow.rotation.x = pose.elbowL;
    armR.elbow.rotation.x = pose.elbowR;

    head.rotation.x = pose.headNod;
    head.rotation.y = pose.headYaw;
    head.rotation.z = pose.headRoll;
    // cap lags a beat behind the head for that hand-animated feel
    cap.rotation.x = -pose.headNod * 0.7;
    cap.rotation.z = -pose.headRoll * 0.5;

    // jersey wind: panel billows from the pinned top, waves rolling down toward the
    // hem. The pivot tilts and the vertices displace only away from the body (+Z is
    // the kid's back) so the cloth can never swing through the shorts and legs.
    const wind = walk.windStrength;
    clothPivot.rotation.x = -0.08 - 0.05 * Math.sin(pose.phase * 0.55) * wind;
    clothPivot.rotation.z = 0.04 * Math.sin(pose.phase * 0.5 + 1.3) * wind;
    const cpos = clothGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cpos.count; i++) {
      const j = i * 3;
      const bx = clothBase[j];
      const by = clothBase[j + 1];
      const bz = clothBase[j + 2];
      const yn = Math.max(0, -by / CLOTH_LEN);
      const w = Math.pow(yn, 1.5) * wind;
      const wave = Math.sin(pose.phase * 0.7 + yn * 3.4 + bx * 1.6);
      const billow = 0.5 + 0.5 * wave; // outward-only displacement
      cpos.setXYZ(
        i,
        bx + 0.04 * w * wave,
        by,
        bz + 0.12 * w * billow + 0.04 * w * (0.5 + 0.5 * Math.sin(pose.phase * 0.45))
      );
    }
    cpos.needsUpdate = true;
    clothGeo.computeVertexNormals();

    frontPanels[0].rotation.x = 0.05 + 0.05 * Math.sin(pose.phase * 0.7 + 0.6) * wind + pose.hipL * 0.12;
    frontPanels[1].rotation.x = 0.05 + 0.05 * Math.sin(pose.phase * 0.7 + 2.1) * wind + pose.hipR * 0.12;

    // outline boil, same 90s ink wobble the buildings use
    for (let i = 0; i < hulls.length; i++) {
      hulls[i].mesh.scale.setScalar(hulls[i].base + rnd(frameIdx * 7 + i, 75) * 0.02);
    }

    // step glow follows the actual feet
    legL.ankle.getWorldPosition(footL);
    legR.ankle.getWorldPosition(footR);
    group.worldToLocal(footL);
    group.worldToLocal(footR);
    const step = Math.abs(Math.cos(pose.phase));
    glowRig.update(pose.plantL, pose.plantR, step, footL.x, footL.z, footR.x, footR.z);
  }

  function destroy() {
    for (const d of disposables) d.dispose();
    glowRig.dispose();
  }

  return { group, update, destroy };
}
