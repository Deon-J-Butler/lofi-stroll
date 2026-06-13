// Inspect a .glb: animations, skins, node hierarchy, mesh stats, bounds.
// Usage: node scripts/inspect-glb.mjs <path-to-glb>
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/inspect-glb.mjs <path-to-glb>');
  process.exit(1);
}

const buf = readFileSync(path);
const magic = buf.readUInt32LE(0);
if (magic !== 0x46546c67) {
  console.error('Not a GLB file');
  process.exit(1);
}
const totalLen = buf.readUInt32LE(8);
console.log(`GLB version ${buf.readUInt32LE(4)}, ${totalLen} bytes`);

let offset = 12;
let json = null;
let bin = null;
while (offset < totalLen) {
  const chunkLen = buf.readUInt32LE(offset);
  const chunkType = buf.readUInt32LE(offset + 4);
  const data = buf.subarray(offset + 8, offset + 8 + chunkLen);
  if (chunkType === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
  else if (chunkType === 0x004e4942) bin = data;
  offset += 8 + chunkLen;
}

console.log('\n=== Top-level keys ===');
console.log(Object.keys(json).join(', '));

console.log('\n=== Asset ===');
console.log(JSON.stringify(json.asset));

console.log(`\n=== Animations: ${(json.animations || []).length} ===`);
for (const a of json.animations || []) {
  console.log(`  "${a.name}" channels=${a.channels.length} samplers=${a.samplers.length}`);
}

console.log(`\n=== Skins: ${(json.skins || []).length} ===`);
for (const s of json.skins || []) {
  console.log(`  "${s.name}" joints=${s.joints.length}`);
}

console.log(`\n=== Meshes: ${(json.meshes || []).length} ===`);
for (const m of json.meshes || []) {
  for (const p of m.primitives) {
    const attrs = Object.keys(p.attributes).join(',');
    const posAcc = json.accessors[p.attributes.POSITION];
    console.log(`  "${m.name}" attrs=[${attrs}] verts=${posAcc.count} min=${JSON.stringify(posAcc.min)} max=${JSON.stringify(posAcc.max)}`);
  }
}

console.log(`\n=== Materials: ${(json.materials || []).length} ===`);
for (const mat of json.materials || []) {
  console.log(`  "${mat.name}" ${JSON.stringify(mat.pbrMetallicRoughness?.baseColorFactor ?? 'textured')}`);
}

console.log(`\n=== Images: ${(json.images || []).length} ===`);
for (const img of json.images || []) console.log(`  ${img.name || img.uri || img.mimeType}`);

console.log('\n=== Node hierarchy ===');
const nodes = json.nodes || [];
const childSet = new Set();
for (const n of nodes) for (const c of n.children || []) childSet.add(c);
function dump(i, depth) {
  const n = nodes[i];
  const bits = [];
  if (n.mesh !== undefined) bits.push(`mesh=${n.mesh}`);
  if (n.skin !== undefined) bits.push(`skin=${n.skin}`);
  if (n.translation) bits.push(`t=${JSON.stringify(n.translation)}`);
  if (n.rotation) bits.push(`r=${JSON.stringify(n.rotation)}`);
  if (n.scale) bits.push(`s=${JSON.stringify(n.scale)}`);
  console.log(`${'  '.repeat(depth)}[${i}] "${n.name || ''}" ${bits.join(' ')}`);
  for (const c of n.children || []) dump(c, depth + 1);
}
for (let i = 0; i < nodes.length; i++) if (!childSet.has(i)) dump(i, 0);
