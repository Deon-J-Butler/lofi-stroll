import * as THREE from 'three';
import type { StepGlowSettings } from '../../registry/types';

const defaultStepGlow: StepGlowSettings = {
  enabled: true,
  size: 0.62,
  intensity: 0.5,
  rimLight: true
};

export type StepGlowRig = {
  /** Add this to the character root. It does NOT bob with the body, so glows stay on the road. */
  group: THREE.Group;
  /**
   * @param plantL/plantR 0..1 foot-strike pulses
   * @param step overall stride energy 0..1 (drives shadow + rim light)
   * @param lx,lz / rx,rz foot positions in the character root's local space
   */
  update: (plantL: number, plantR: number, step: number, lx: number, lz: number, rx: number, rz: number) => void;
  dispose: () => void;
};

export function createStepGlowRig(settings?: Partial<StepGlowSettings>): StepGlowRig {
  const cfg = { ...defaultStepGlow, ...(settings ?? {}) };
  const group = new THREE.Group();

  if (!cfg.enabled) {
    return { group, update: () => {}, dispose: () => {} };
  }

  const glowCv = document.createElement('canvas');
  glowCv.width = 128;
  glowCv.height = 128;
  const g = glowCv.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(64, 64, 5, 64, 64, 62);
    grd.addColorStop(0.0, 'rgba(255,235,148,0.95)');
    grd.addColorStop(0.3, 'rgba(255,183,62,0.44)');
    grd.addColorStop(1.0, 'rgba(255,183,62,0.00)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const glowTex = new THREE.CanvasTexture(glowCv);

  function makeGlow() {
    const mat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(cfg.size, cfg.size * 0.72), mat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    glow.renderOrder = 80;
    return glow;
  }

  const glowL = makeGlow();
  const glowR = makeGlow();
  group.add(glowL, glowR);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.42, 0.58),
    new THREE.MeshBasicMaterial({
      color: 0x05030d,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.012, 0.085);
  shadow.renderOrder = 70;
  group.add(shadow);

  let rim: THREE.PointLight | null = null;
  if (cfg.rimLight) {
    rim = new THREE.PointLight(0x8affff, 0.45, 4.5);
    rim.position.set(0, 1.55, 1.15);
    group.add(rim);
  }

  function update(plantL: number, plantR: number, step: number, lx: number, lz: number, rx: number, rz: number) {
    glowL.position.x = lx;
    glowL.position.z = lz;
    glowR.position.x = rx;
    glowR.position.z = rz;

    const lm = glowL.material as THREE.MeshBasicMaterial;
    const rm = glowR.material as THREE.MeshBasicMaterial;
    lm.opacity = 0.06 + plantL * cfg.intensity;
    rm.opacity = 0.06 + plantR * cfg.intensity;
    glowL.scale.setScalar(0.88 + plantL * 0.34);
    glowR.scale.setScalar(0.88 + plantR * 0.34);

    shadow.position.x = (lx + rx) / 2;
    shadow.scale.set(1 + step * 0.1, 1 + step * 0.04, 1);
    (shadow.material as THREE.MeshBasicMaterial).opacity = 0.18 + step * 0.1;

    if (rim) rim.intensity = 0.32 + step * 0.2;
  }

  function dispose() {
    for (const mesh of [glowL, glowR, shadow]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    glowTex.dispose();
  }

  return { group, update, dispose };
}
