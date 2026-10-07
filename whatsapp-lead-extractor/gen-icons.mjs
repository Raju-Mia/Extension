import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Minimal, dependency-free PNG encoder that draws an ORIGINAL, non-trademark
// icon: a green rounded square containing a white "member list" (three bullet
// rows) on the left and a white "export" download arrow on the right. This is
// the sibling of telegram-lead-extractor/gen-icons.mjs (same glyph, different
// brand-neutral color). It deliberately does NOT reproduce the WhatsApp
// chat-bubble logo or any Meta trademark. Run with:
//   node gen-icons.mjs
// Only used at setup time; the build copies the generated sizes into dist/.

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "icons");
mkdirSync(outDir, { recursive: true });

const BG = { r: 0x15, g: 0x80, b: 0x3d }; // neutral emerald green (not WhatsApp's exact brand green)
const FG = { r: 0xff, g: 0xff, b: 0xff }; // white glyph

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function roundedInside(x, y, size, r) {
  const inCorner = (cx, cy) => {
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  };
  if (x < r && y < r) return inCorner(r, r);
  if (x >= size - r && y < r) return inCorner(size - r - 1, r);
  if (x < r && y >= size - r) return inCorner(r, size - r - 1);
  if (x >= size - r && y >= size - r) return inCorner(size - r - 1, size - r - 1);
  return true;
}

// Normalized shape tests (u, v in 0..1).
function inCircle(u, v, cx, cy, r) {
  const dx = u - cx;
  const dy = v - cy;
  return dx * dx + dy * dy <= r * r;
}
function inRect(u, v, u0, v0, u1, v1) {
  return u >= u0 && u <= u1 && v >= v0 && v <= v1;
}
function inArrowHead(u, v) {
  // Triangle: base at v=0.56 (half-width 0.11) to apex at v=0.74, centered 0.79.
  if (v < 0.56 || v > 0.74) return false;
  const halfWidth = 0.11 * ((0.74 - v) / (0.74 - 0.56));
  return Math.abs(u - 0.79) <= halfWidth;
}

function isGlyph(u, v) {
  // Member list: three bullet + bar rows on the left.
  for (const cy of [0.3, 0.5, 0.7]) {
    if (inCircle(u, v, 0.2, cy, 0.055)) return true;
    if (inRect(u, v, 0.31, cy - 0.04, 0.55, cy + 0.04)) return true;
  }
  // Export arrow on the right: shaft, head, tray.
  if (inRect(u, v, 0.75, 0.28, 0.83, 0.58)) return true; // shaft
  if (inArrowHead(u, v)) return true; // head
  if (inRect(u, v, 0.66, 0.82, 0.92, 0.88)) return true; // tray
  return false;
}

function makePng(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  const radius = Math.max(1, Math.round(size * 0.22));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inside = roundedInside(x, y, size, radius);
      const u = x / size;
      const v = y / size;
      const glyph = inside && isGlyph(u, v);
      const color = glyph ? FG : BG;
      raw[offset++] = color.r;
      raw[offset++] = color.g;
      raw[offset++] = color.b;
      raw[offset++] = inside ? 255 : 0;
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(resolve(outDir, `icon${size}.png`), makePng(size));
  console.log(`icons/icon${size}.png`);
}
