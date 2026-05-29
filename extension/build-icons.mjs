/**
 * build-icons.mjs
 * Generates crisp Fidelity-green diamond sunburst extension icons from SVG geometry.
 * No AI image generation → no white halo fringe. Run: node extension/build-icons.mjs
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const extDir = path.resolve('extension');

// ─── Palette ──────────────────────────────────────────────────────────────
const GREEN_DARK  = '#005C2E';   // deep Fidelity green
const GREEN_MID   = '#007A3D';   // classic Fidelity green
const GREEN_LIGHT = '#00A050';   // accent green
const BLACK       = '#0A0A0A';
const WHITE       = '#FFFFFF';

// ─── Canvas ───────────────────────────────────────────────────────────────
const W = 256, H = 256;
const CX = W / 2, CY = H / 2;

// Diamond vertices — tight but leaving room for the double border stroke
const PAD  = 6;
const TOP   = `${CX},${PAD}`;
const RIGHT = `${W - PAD},${CY}`;
const BOT   = `${CX},${H - PAD}`;
const LEFT  = `${PAD},${CY}`;
const DIAMOND_PTS = `${TOP} ${RIGHT} ${BOT} ${LEFT}`;

// ─── Sunburst segments ────────────────────────────────────────────────────
// 8 triangular segments radiating from centre, full 360°, clipped to diamond.
// Rotated 22.5° so segment boundaries align with the diamond's 4 corners
// — this avoids a divider line pointing straight at a tip.
const SEGMENTS  = 8;
const SLICE_DEG = 360 / SEGMENTS;
const OFFSET    = 22.5;        // rotate so corners fall inside segments, not on dividers
const R         = 160;         // radius — larger than diamond so clip fills fully

const toRad = d => (d * Math.PI) / 180;

// Cycle through three greens for visual depth
const palette = [GREEN_DARK, GREEN_MID, GREEN_LIGHT, GREEN_MID,
                 GREEN_DARK, GREEN_MID, GREEN_LIGHT, GREEN_MID];

function segPath(i) {
  const a1 = toRad(OFFSET + i * SLICE_DEG);
  const a2 = toRad(OFFSET + (i + 1) * SLICE_DEG);
  // Two arc points far enough to be clipped by the diamond
  const x1 = CX + R * Math.cos(a1);
  const y1 = CY + R * Math.sin(a1);
  const x2 = CX + R * Math.cos(a2);
  const y2 = CY + R * Math.sin(a2);
  return `<polygon
    points="${CX},${CY} ${x1.toFixed(2)},${y1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}"
    fill="${palette[i]}"
    stroke="${BLACK}" stroke-width="3" stroke-linejoin="round"/>`;
}

const segments = Array.from({ length: SEGMENTS }, (_, i) => segPath(i)).join('\n    ');

// ─── SVG assembly ─────────────────────────────────────────────────────────
const svg = `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <!-- Clip segments to diamond shape -->
    <clipPath id="dc">
      <polygon points="${DIAMOND_PTS}"/>
    </clipPath>
  </defs>

  <!-- Sunburst segments clipped to diamond -->
  <g clip-path="url(#dc)">
    ${segments}
  </g>

  <!-- Black outer border (wide) -->
  <polygon points="${DIAMOND_PTS}"
    fill="none"
    stroke="${BLACK}" stroke-width="14" stroke-linejoin="round"/>

  <!-- White inner border ring — inset ~10px from outer edge, sits just inside black -->
  <polygon points="${CX},${PAD + 10} ${W - PAD - 10},${CY} ${CX},${H - PAD - 10} ${PAD + 10},${CY}"
    fill="none"
    stroke="${WHITE}" stroke-width="3.5" stroke-linejoin="round"/>

  <!-- Re-stroke divider lines from centre so they show above the clip -->
  <g stroke="${BLACK}" stroke-width="2.5" opacity="0.6">
    ${Array.from({ length: SEGMENTS }, (_, i) => {
      const a = toRad(OFFSET + i * SLICE_DEG);
      const ex = (CX + R * Math.cos(a)).toFixed(2);
      const ey = (CY + R * Math.sin(a)).toFixed(2);
      return `<line x1="${CX}" y1="${CY}" x2="${ex}" y2="${ey}" clip-path="url(#dc)"/>`;
    }).join('\n    ')}
  </g>
</svg>`;

// ─── Rasterize ────────────────────────────────────────────────────────────
const sizes = [16, 48, 128];

for (const size of sizes) {
  const outPath = path.join(extDir, `icon${size}.png`);
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  console.log(`✓ icon${size}.png  (${size}×${size})`);
}

console.log('\nAll icons written — diamond shape, double border, transparent background.');
