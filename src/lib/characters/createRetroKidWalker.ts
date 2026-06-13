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

// World-ink palette + lofi hoodie fit
const INK = 0x0d0618;
const SKIN = 0x96603c;
const HOODIE = 0x111111;
const HOODIE_DARK = 0x080808;
const DENIM = 0x3b5a8f;
const DENIM_CUFF = 0x6c8ec4;
const SNEAKER_BLACK = 0x161616;
const SNEAKER_BLACK_SOLE = 0x0e0e0e;
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

function hoodieBackTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#111111';
  g.fillRect(0, 0, 256, 256);
  // Keep the logo high on the back panel so the hood drape does not cover it.
  g.font = 'bold 64px Arial Black, Impact, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.strokeStyle = '#000000';
  g.lineWidth = 12;
  g.lineJoin = 'round';
  g.strokeText('LO-FI', 128, 92);
  g.fillStyle = '#f2f2f2';
  g.fillText('LO-FI', 128, 92);
  // thin inner outline for crispness
  g.strokeStyle = '#222222';
  g.lineWidth = 2;
  g.strokeText('LO-FI', 128, 92);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hoodieLogoTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 96;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, cv.width, cv.height);
  g.font = 'bold 54px Arial Black, Impact, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.strokeStyle = '#050505';
  g.lineWidth = 12;
  g.strokeText('LO-FI', 128, 48);
  g.fillStyle = '#f4f4f0';
  g.fillText('LO-FI', 128, 48);
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 2;
  g.strokeText('LO-FI', 128, 48);
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

    // denim thigh — full pants, no shorts cuff
    const thigh = capsule(0.14, 0.18, DENIM, true);
    thigh.position.y = -THIGH_LEN / 2;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -THIGH_LEN;
    hip.add(knee);

    const calf = capsule(0.12, 0.18, DENIM, true);
    calf.position.y = -CALF_LEN / 2;
    knee.add(calf);

    const ankle = new THREE.Group();
    ankle.position.y = -CALF_LEN;
    knee.add(ankle);

    // pant-leg cuff above the sneaker
    const ankleCuff = mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.10, 10), DENIM, true, 1.07);
    ankleCuff.position.y = 0.07;
    ankle.add(ankleCuff);
    const ankleCuffRing = mesh(new THREE.CylinderGeometry(0.143, 0.147, 0.028, 10), DENIM_CUFF);
    ankleCuffRing.position.y = 0.02;
    ankle.add(ankleCuffRing);

    ankle.add(buildSneaker());
    return { hip, knee, ankle };
  }

  // Black chunky sneaker
  function buildSneaker(): THREE.Group {
    const shoe = new THREE.Group();
    shoe.position.y = -0.02;

    const sole = mesh(new THREE.BoxGeometry(0.21, 0.06, 0.4), SNEAKER_BLACK_SOLE, true, 1.1);
    sole.position.set(0, -0.1, -0.06);
    shoe.add(sole);

    const upper = mesh(new THREE.BoxGeometry(0.19, 0.12, 0.3), SNEAKER_BLACK, true, 1.09);
    upper.position.set(0, -0.02, -0.04);
    shoe.add(upper);

    const toe = mesh(new THREE.SphereGeometry(0.1, 10, 8), SNEAKER_BLACK, true, 1.12);
    toe.scale.set(0.95, 0.7, 1.25);
    toe.position.set(0, -0.06, -0.2);
    shoe.add(toe);

    const heel = mesh(new THREE.BoxGeometry(0.2, 0.1, 0.09), SNEAKER_BLACK, true, 1.08);
    heel.position.set(0, -0.04, 0.1);
    shoe.add(heel);

    const collar = mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.07, 10), HOODIE_DARK);
    collar.position.set(0, 0.06, 0.02);
    shoe.add(collar);

    return shoe;
  }

  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  // ---- spine / torso ----
  const spine = new THREE.Group();
  spine.position.y = SPINE_Y;
  pelvis.add(spine);

  const torso = capsule(0.345, 0.2, HOODIE, true);
  torso.scale.z = 0.85;
  torso.position.y = 0.26;
  spine.add(torso);

  // ---- arms ----
  type Arm = { shoulder: THREE.Group; elbow: THREE.Group };
  function buildArm(side: -1 | 1): Arm {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * SHOULDER_X, SHOULDER_Y, 0);
    spine.add(shoulder);

    // shoulder cap blends into the sleeve
    const sleeve = mesh(new THREE.CylinderGeometry(0.145, 0.155, 0.22, 10), HOODIE, true, 1.08);
    sleeve.position.y = -0.08;
    shoulder.add(sleeve);

    // full hoodie upper-arm sleeve
    const upper = capsule(0.105, 0.10, HOODIE, true);
    upper.position.y = -UPPER_ARM_LEN / 2;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -UPPER_ARM_LEN;
    shoulder.add(elbow);

    // full hoodie forearm sleeve, tapers toward the wrist
    const forearm = capsule(0.093, 0.09, HOODIE, true);
    forearm.position.y = -FOREARM_LEN / 2;
    elbow.add(forearm);

    // wrist cuff ring
    const wristCuff = mesh(new THREE.CylinderGeometry(0.098, 0.105, 0.055, 10), HOODIE_DARK, true, 1.05);
    wristCuff.position.y = -FOREARM_LEN + 0.01;
    elbow.add(wristCuff);

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

  // Hood: parented to neck so it moves with the garment, not the head.
  // Lowered to sit at collar level — makes it read as clothing, not a bob.
  const hood = new THREE.Group();
  hood.position.set(0, 0.46, 0.06);
  neck.add(hood);

  // Hood shell: wide in x, shorter in y so from behind it reads as a broad hood dome
  // rather than a round ball. phi covers forehead-to-nape arc.
  const hoodShell = mesh(new THREE.SphereGeometry(0.70, 22, 16, 0, Math.PI * 2, 0, 2.25), HOODIE, true, 1.04);
  hoodShell.scale.set(1.28, 0.90, 1.08);  // wide & low = hood silhouette, not bob
  hoodShell.position.set(0, 0.04, 0.12);  // set back so it covers the rear of the head
  hood.add(hoodShell);

  // face opening rim
  const hoodRim = mesh(new THREE.TorusGeometry(0.56, 0.058, 8, 22, Math.PI * 1.20), HOODIE_DARK, true, 1.06);
  hoodRim.rotation.x = -0.42;
  hoodRim.rotation.y = Math.PI;
  hoodRim.position.set(0, -0.16, -0.12);
  hood.add(hoodRim);

  // Cowl: tapered cylinder that runs from just below the hood shell all the way
  // down through the neck to the top of the torso — single seamless silhouette.
  const hoodieCowl = mesh(new THREE.CylinderGeometry(0.40, 0.50, 0.72, 14), HOODIE, true, 1.05);
  hoodieCowl.position.set(0, 0.54, 0.01);
  spine.add(hoodieCowl);

  // Hood back-drape: wide cloth panel that bridges the gap between the hood shell
  // and the top of the main back cloth, killing the disconnected "bob" seam.
  const hoodDrapePivot = new THREE.Group();
  hoodDrapePivot.position.set(0, 0.0, 0.48);  // starts at the equator of the hood shell
  hood.add(hoodDrapePivot);
  const DRAPE_H = 0.48;
  const hoodDrapeGeo = new THREE.PlaneGeometry(0.68, DRAPE_H, 5, 8);
  hoodDrapeGeo.translate(0, -DRAPE_H / 2, 0);
  disposables.push(hoodDrapeGeo);
  {
    const drapePos = hoodDrapeGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < drapePos.count; i++) {
      const x = drapePos.getX(i);
      const y = drapePos.getY(i);
      const yn = Math.max(0, -y / DRAPE_H);
      const flare = 1 + 0.22 * yn;  // widens as it drops
      drapePos.setXYZ(i, x * flare, y, 0.06 * Math.pow(yn, 1.2));
    }
    hoodDrapeGeo.computeVertexNormals();
  }
  const hoodDrapeBase = new Float32Array((hoodDrapeGeo.attributes.position as THREE.BufferAttribute).array);
  const hoodDrapeMatInst = new THREE.MeshToonMaterial({ color: HOODIE, side: THREE.DoubleSide });
  disposables.push(hoodDrapeMatInst);
  const hoodDrape = new THREE.Mesh(hoodDrapeGeo, hoodDrapeMatInst);
  const hoodDrapeHull = new THREE.Mesh(hoodDrapeGeo, outlineMat);
  hoodDrapeHull.scale.setScalar(1.05);
  hoodDrape.add(hoodDrapeHull);
  hoodDrapePivot.add(hoodDrape);

  // ---- hoodie back panel with arched LOFI text ----
  const hoodieTex = hoodieBackTexture();
  disposables.push(hoodieTex);
  const hoodieLogoTex = hoodieLogoTexture();
  disposables.push(hoodieLogoTex);

  // shoulder yoke
  const yoke = mesh(new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, 1.5), HOODIE, true, 1.05);
  yoke.scale.set(1.06, 0.78, 0.96);
  yoke.position.y = 0.44;
  spine.add(yoke);

  // back panel: hoodie body pinned at the yoke, gently animated
  const backPanelMat = new THREE.MeshToonMaterial({ map: hoodieTex, side: THREE.DoubleSide });
  disposables.push(backPanelMat);
  const clothGeo = new THREE.PlaneGeometry(0.78, CLOTH_LEN, 6, 8);
  disposables.push(clothGeo);
  clothGeo.translate(0, -CLOTH_LEN / 2, 0);
  {
    const pos = clothGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const yn = Math.max(0, -y / CLOTH_LEN);
      const flare = 1 + 0.12 * yn;
      pos.setXYZ(i, x * flare, y, -0.12 * Math.pow((x * flare) / 0.45, 2));
    }
    clothGeo.computeVertexNormals();
  }
  const clothBase = new Float32Array((clothGeo.attributes.position as THREE.BufferAttribute).array);
  const clothPivot = new THREE.Group();
  clothPivot.position.set(0, 0.54, 0.30);  // raised to butt up against the cowl top
  spine.add(clothPivot);
  const backPanel = new THREE.Mesh(clothGeo, backPanelMat);
  clothPivot.add(backPanel);

  const logoMat = new THREE.MeshBasicMaterial({
    map: hoodieLogoTex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4
  });
  disposables.push(logoMat);
  const logoGeo = new THREE.PlaneGeometry(0.86, 0.32);
  disposables.push(logoGeo);
  const logoPatch = new THREE.Mesh(logoGeo, logoMat);
  logoPatch.position.set(0, 0.25, 0.58);
  logoPatch.renderOrder = 60;
  spine.add(logoPatch);

  // front hoodie panels (closed — not an open jersey)
  const frontPanels: THREE.Group[] = [];
  for (const side of [-1, 1] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.18, 0.46, -0.26);
    pivot.rotation.y = side * 0.30;
    spine.add(pivot);
    const geo = new THREE.PlaneGeometry(0.28, 0.60, 1, 3);
    geo.translate(0, -0.30, 0);
    const panel = mesh(geo, HOODIE);
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
    // hood is on neck — gently follows the head so it doesn't look rigid
    hood.rotation.x = pose.headNod * 0.20;
    hood.rotation.y = pose.headYaw * 0.25;
    hood.rotation.z = pose.headRoll * 0.12;

    // hood back-drape — gentle independent cloth sway
    const drapeWind = walk.windStrength * 0.55;
    hoodDrapePivot.rotation.x = -0.06 - 0.04 * Math.sin(pose.phase * 0.6 + 0.8) * drapeWind;
    hoodDrapePivot.rotation.z = 0.025 * Math.sin(pose.phase * 0.5 + 2.1) * drapeWind;
    const dpos = hoodDrapeGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dpos.count; i++) {
      const j = i * 3;
      const bx = hoodDrapeBase[j], by = hoodDrapeBase[j + 1], bz = hoodDrapeBase[j + 2];
      const yn = Math.max(0, -by / DRAPE_H);
      const dw = Math.pow(yn, 1.4) * drapeWind;
      const wave = Math.sin(pose.phase * 0.8 + yn * 3.0 + bx * 1.2);
      dpos.setXYZ(i, bx + 0.03 * dw * wave, by, bz + 0.09 * dw * (0.5 + 0.5 * wave));
    }
    dpos.needsUpdate = true;
    hoodDrapeGeo.computeVertexNormals();

    // hoodie back: subtle sway, much less billowing than an open jersey
    const wind = walk.windStrength * 0.45;
    clothPivot.rotation.x = -0.05 - 0.03 * Math.sin(pose.phase * 0.55) * wind;
    clothPivot.rotation.z = 0.02 * Math.sin(pose.phase * 0.5 + 1.3) * wind;
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
