/**
 * build-icons.mjs
 * Generates crisp Fidelity-green sunburst pyramid extension icons from SVG geometry.
 * No image generation → no white halo fringe. Run: node extension/build-icons.mjs
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const extDir = path.resolve('extension');

// ─── SVG: Fidelity-style sunburst pyramid ─────────────────────────────────
// 7 triangular segments radiating from a centre point at the base of the pyramid,
// arranged symmetrically into a classic "sunburst" stack.
// Colours alternate between two Fidelity greens for depth; black stroke separates.
const W = 256, H = 256;
const GREEN   = '#006633';  // Fidelity signature dark green
const GREEN2  = '#008844';  // slightly lighter green for alternating segments
const STROKE  = '#000000';
const SW      = 6;          // stroke width (scales down cleanly)

// Centre "apex" emitter point — lower-centre of canvas
const CX = W / 2;
const CY = H * 0.88;

// Helper: degrees → radians
const r = deg => (deg * Math.PI) / 180;

// Build a triangle path from centre-point to two arc points at radius R, angle A1→A2
// Angles are measured from top (12 o'clock), sweeping clockwise
function seg(a1, a2, R, col) {
  const x1 = CX + R * Math.sin(r(a1));
  const y1 = CY - R * Math.cos(r(a1));
  const x2 = CX + R * Math.sin(r(a2));
  const y2 = CY - R * Math.cos(r(a2));
  return `<polygon points="${CX},${CY} ${x1},${y1} ${x2},${y2}"
    fill="${col}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
}

// 7 segments: spread from -62° to +62° in equal 18° slices (7 × 18 = 126° total fan)
const SEGMENTS = 7;
const SPAN = 124;  // total fan degrees
const SLICE = SPAN / SEGMENTS;
const START = -SPAN / 2;
const R = H * 0.95;  // radius — nearly full canvas height

const colours = [GREEN2, GREEN, GREEN2, GREEN, GREEN2, GREEN, GREEN2];

const segs = Array.from({ length: SEGMENTS }, (_, i) => {
  const a1 = START + i * SLICE;
  const a2 = a1 + SLICE;
  return seg(a1, a2, R, colours[i]);
}).join('\n  ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  ${segs}
</svg>`;

// ─── Rasterize to each icon size ──────────────────────────────────────────
const sizes = [16, 48, 128];

for (const size of sizes) {
  const outPath = path.join(extDir, `icon${size}.png`);
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  console.log(`✓ icon${size}.png  (${size}×${size})`);
}

console.log('\nAll icons written — no halo, crisp edges, transparent background.');
