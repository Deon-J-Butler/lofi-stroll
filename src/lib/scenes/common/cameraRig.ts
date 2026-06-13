import * as THREE from 'three';

export type ViewMode = 'default' | 'side';

/**
 * Shared camera framing for every scene.
 *
 * - `default` — the classic over-the-shoulder shot, looking down the road (-Z)
 *   with the character's back to us. Scenes feed it their own gentle FOV breathe.
 * - `side` — swings out to +X and looks back across the lane in profile, on a
 *   steadier, narrower lens. This is the angle used to check character layering
 *   (cape over legs, limb depth, foot glows) — now a Studio toggle.
 *
 * The frame loop calls apply() every tick so the active view always wins, even
 * though only the FOV used to be touched per frame.
 */
export function createCameraRig(camera: THREE.PerspectiveCamera) {
  const views: Record<ViewMode, { pos: THREE.Vector3; target: THREE.Vector3; fov: number }> = {
    default: { pos: new THREE.Vector3(0, 3.4, 7.6), target: new THREE.Vector3(0, 1.9, -10), fov: 95 },
    side: { pos: new THREE.Vector3(8.8, 4.7, 1.4), target: new THREE.Vector3(0, 2.6, -1.6), fov: 52 }
  };
  let mode: ViewMode = 'default';

  function setView(next: ViewMode) {
    mode = next;
  }

  /** @param fovBreathe additive FOV wobble, only applied to the default view. */
  function apply(fovBreathe = 0) {
    const v = views[mode];
    camera.position.copy(v.pos);
    camera.lookAt(v.target);
    camera.fov = v.fov + (mode === 'default' ? fovBreathe : 0);
    camera.updateProjectionMatrix();
  }

  return {
    setView,
    apply,
    get mode() {
      return mode;
    }
  };
}
