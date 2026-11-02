// Draws the dumbbell app icons as PNGs with Node built-ins only.
// Run: node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x10, 0x15, 0x14];
const FG = [0x3f, 0xc9, 0xa6];

// Glyph in 0..1 coordinates: [x0, y0, x1, y1, cornerRadius]
const GLYPH = [
  [0.30, 0.47, 0.70, 0.53, 0.01],
  [0.24, 0.32, 0.32, 0.68, 0.025], [0.68, 0.32, 0.76, 0.68, 0.025],
  [0.17, 0.38, 0.24, 0.62, 0.025], [0.76, 0.38, 0.83, 0.62, 0.025],
];

function inRoundRect(x, y, [x0, y0, x1, y1, r]) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function draw(size, bgRadius) {
  const px = Buffer.alloc(size * size * 4);
  const N = 4; // supersampling per axis
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let bg = 0, fg = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const x = (i + (sx + 0.5) / N) / size;
          const y = (j + (sy + 0.5) / N) / size;
          if (!inRoundRect(x, y, [0, 0, 1, 1, bgRadius])) continue;
          bg++;
          if (GLYPH.some(g => inRoundRect(x, y, g))) fg++;
        }
      }
      const o = (j * size + i) * 4;
      const t = bg ? fg / bg : 0;
      for (let c = 0; c < 3; c++) px[o + c] = Math.round(BG[c] + (FG[c] - BG[c]) * t);
      px[o + 3] = Math.round((bg / (N * N)) * 255);
    }
  }
  return png(size, px);
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../icons/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('icon-192.png', out), draw(192, 0.22));
writeFileSync(new URL('icon-512.png', out), draw(512, 0.22));
writeFileSync(new URL('icon-maskable-512.png', out), draw(512, 0));
writeFileSync(new URL('apple-touch-icon.png', out), draw(180, 0));
console.log('icons written');
