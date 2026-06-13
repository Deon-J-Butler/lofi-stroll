import * as THREE from 'three';

/**
 * Axes + FRONT/BACK markers for inspecting character orientation.
 * Convention: -Z is "front" (the direction the character walks, away from the camera),
 * +Z is "back" (faces the viewer). Add it to the character root, then check that the
 * magenta cone and FRONT label point down the road toward the sun.
 */
export function createOrientationGizmo(size = 1.6): THREE.Group {
  const group = new THREE.Group();
  group.position.y = 0.03;

  group.add(new THREE.AxesHelper(size));

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.4, 10),
    new THREE.MeshBasicMaterial({ color: 0xff44ff })
  );
  cone.rotation.x = -Math.PI / 2;
  cone.position.set(0, 0.02, -size);
  group.add(cone);

  function label(text: string, z: number, color: string) {
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 40;
    const g = cv.getContext('2d');
    if (g) {
      g.font = 'bold 26px monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = color;
      g.fillText(text, 64, 20);
    }
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false })
    );
    sprite.scale.set(0.9, 0.28, 1);
    sprite.position.set(0, 0.35, z);
    group.add(sprite);
  }

  label('FRONT', -size - 0.35, '#ff66ff');
  label('BACK', size * 0.7, '#66e0ff');

  return group;
}
