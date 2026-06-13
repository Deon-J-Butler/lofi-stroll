import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CharacterDefinition } from '../registry/types';
import { createStepGlowRig } from './common/stepGlowRig';
import { createOrientationGizmo } from '../debug/orientationGizmo';
import type { CharacterController, Rng } from './controller';

/**
 * Reference controller for static, unrigged GLBs (the uploaded AI-generated chibi).
 * The model has no skeleton or animations (verified with scripts/inspect-glb.mjs),
 * so this applies a lightweight procedural vertex deformer for a step-ish motion.
 * Kept for visual comparison; the real character is the retro-kid walker.
 */

const STRIDE_HZ = 0.9;
const CHAR_FPS = 8;

type WalkDeformer = {
  update: (phase: number) => void;
};

export function createFoxChibiWalker(character: CharacterDefinition, rnd: Rng): CharacterController {
  const baseYaw = character.rotationY ?? Math.PI;
  const characterScale = character.scale ?? 3.05;
  const group = new THREE.Group();
  if (character.position) {
    group.position.set(character.position.x, character.position.y, character.position.z);
  }

  // bobbing happens on the mount so the glow rig stays glued to the road
  const mount = new THREE.Group();
  mount.rotation.y = baseYaw;
  group.add(mount);

  const glowRig = createStepGlowRig(character.stepGlow);
  group.add(glowRig.group);
  if (character.debug) group.add(createOrientationGizmo());

  let model: THREE.Group | null = null;
  const mixers: THREE.AnimationMixer[] = [];
  const walkDeformers: WalkDeformer[] = [];

  function fitLoadedModel(loadedModel: THREE.Group) {
    loadedModel.scale.setScalar(characterScale);
    loadedModel.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(loadedModel);
    const center = box.getCenter(new THREE.Vector3());
    loadedModel.position.x -= center.x;
    loadedModel.position.z -= center.z;
    loadedModel.position.y -= box.min.y;
  }

  function makeWalkDeformer(mesh: THREE.Mesh): WalkDeformer | null {
    const sourceGeometry = mesh.geometry;
    const position = sourceGeometry?.attributes?.position;
    if (!position || !(position instanceof THREE.BufferAttribute)) return null;

    mesh.geometry = sourceGeometry.clone();
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const base = new Float32Array(pos.array.length);
    base.set(pos.array as ArrayLike<number>);

    const box = new THREE.Box3().setFromBufferAttribute(pos);
    const size = box.getSize(new THREE.Vector3());
    const minY = box.min.y;
    const height = Math.max(0.0001, size.y);
    const halfWidth = Math.max(0.0001, Math.max(Math.abs(box.min.x), Math.abs(box.max.x)));

    return {
      update(phase: number) {
        const stride = Math.sin(phase);
        const counter = Math.cos(phase);

        for (let i = 0; i < pos.count; i++) {
          const j = i * 3;
          const x0 = base[j];
          const y0 = base[j + 1];
          const z0 = base[j + 2];
          const yn = (y0 - minY) / height;
          const side = x0 >= 0 ? 1 : -1;
          const lateral = Math.min(1, Math.abs(x0) / halfWidth);
          const feet = Math.max(0, Math.min(1, (0.22 - yn) / 0.22));
          const lower = Math.max(0, Math.min(1, (0.44 - yn) / 0.34));
          const arms =
            Math.max(0, Math.min(1, (lateral - 0.45) / 0.55)) *
            Math.max(0, Math.min(1, (yn - 0.3) / 0.25)) *
            Math.max(0, Math.min(1, (0.78 - yn) / 0.24));
          const torso =
            Math.max(0, Math.min(1, (yn - 0.32) / 0.18)) *
            Math.max(0, Math.min(1, (0.72 - yn) / 0.26));

          pos.setXYZ(
            i,
            x0 + side * counter * 0.0025 * torso,
            y0 + Math.max(0, side * stride) * 0.007 * feet,
            z0 + side * stride * (0.007 * feet + 0.004 * lower) - side * stride * 0.007 * arms
          );
        }

        pos.needsUpdate = true;
      }
    };
  }

  function registerWalkDeformers(loadedModel: THREE.Group) {
    walkDeformers.length = 0;
    loadedModel.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const deformer = makeWalkDeformer(obj);
      if (deformer) walkDeformers.push(deformer);
    });
  }

  function tuneMaterials(loadedModel: THREE.Group) {
    loadedModel.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.frustumCulled = false;
      obj.castShadow = false;
      obj.receiveShadow = false;
      obj.renderOrder = 75;

      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (!material) continue;
        material.side = THREE.DoubleSide;
        material.fog = false;
        material.depthTest = true;
        material.depthWrite = true;

        if ('map' in material && material.map instanceof THREE.Texture) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.generateMipmaps = true;
          material.map.needsUpdate = true;
        }

        if ('emissiveIntensity' in material) material.emissiveIntensity = 0;
        material.needsUpdate = true;
      }
    });
  }

  if (character.modelUrl) {
    const loader = new GLTFLoader();
    loader.load(
      character.modelUrl,
      (gltf) => {
        model = gltf.scene;
        tuneMaterials(model);
        mount.add(model);
        fitLoadedModel(model);
        registerWalkDeformers(model);

        for (const clip of gltf.animations) {
          const mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(clip).play();
          mixers.push(mixer);
        }
      },
      undefined,
      (err) => {
        console.error('Unable to load chibi GLB:', err);
      }
    );
  } else {
    console.warn(`glb-walker character "${character.id}" has no modelUrl`);
  }

  function update(qt: number, frameIdx: number) {
    const phase = qt * STRIDE_HZ * Math.PI * 2;
    const sway = Math.sin(phase);
    const step = Math.abs(Math.cos(phase));
    const leftPulse = Math.max(0, Math.cos(phase));
    const rightPulse = Math.max(0, -Math.cos(phase));

    for (const mixer of mixers) mixer.update(1 / CHAR_FPS);

    mount.position.x = 0.032 * sway + (rnd(frameIdx, 55) - 0.5) * 0.014;
    mount.position.y = 0.015 + 0.048 * step + (rnd(frameIdx, 57) - 0.5) * 0.008;
    mount.rotation.z = 0.014 * sway + (rnd(frameIdx, 59) - 0.5) * 0.006;
    mount.rotation.y = baseYaw + 0.014 * sway;
    mount.rotation.x = -0.014 * step;
    for (const deformer of walkDeformers) deformer.update(phase);

    if (model) {
      model.rotation.z = -0.008 * sway;
      model.rotation.x = 0.008 * Math.sin(phase * 0.5);
    }

    glowRig.update(
      leftPulse,
      rightPulse,
      step,
      -0.34,
      0.17 + leftPulse * 0.03,
      0.34,
      0.17 + rightPulse * 0.03
    );
  }

  function destroy() {
    mount.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry?.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) material?.dispose();
    });
    glowRig.dispose();
  }

  return { group, update, destroy };
}
