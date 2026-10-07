import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Minimal, dependency-free PNG encoder that draws an ORIGINAL, non-trademark
// icon: a brand-neutral teal rounded square containing a white location pin on
// the left and a white "export" download arrow on the right. It deliberately
// does NOT reproduce the Google "Maps" pin, Google's multicolor palette, or any
// Google trademark. Sibling of the whatsapp/telegram gen-icons.mjs scripts.
// Run with:  node gen-icons.mjs

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "icons");
mkdirSync(outDir, { recursive: true });

const BG = { r: 0x0e, g: 0x74, b: 0x90 }; // neutral teal (not Google blue/multicolor)
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

function inCircle(u, v, cx, cy, r) {
  const dx = u - cx;
  const dy = v - cy;
  return dx * dx + dy * dy <= r * r;
}
function inRect(u, v, u0, v0, u1, v1) {
  return u >= u0 && u <= u1 && v >= v0 && v <= v1;
}

// Location pin: circle head + triangular tail to a point, with a hollow center.
function isPin(u, v) {
  const head = inCircle(u, v, 0.3, 0.4, 0.16);
  const hole = inCircle(u, v, 0.3, 0.4, 0.07);
  let tail = false;
  if (v >= 0.44 && v <= 0.72) {
    const halfWidth = 0.12 * ((0.72 - v) / (0.72 - 0.44));
    tail = Math.abs(u - 0.3) <= halfWidth;
  }
  return (head || tail) && !hole;
}

// Export arrow: shaft, head, tray (right side).
function isArrow(u, v) {
  if (inRect(u, v, 0.66, 0.24, 0.74, 0.54)) return true; // shaft
  if (v >= 0.5 && v <= 0.7) {
    const halfWidth = 0.12 * ((0.7 - v) / (0.7 - 0.5));
    if (Math.abs(u - 0.7) <= halfWidth) return true; // head
  }
  if (inRect(u, v, 0.58, 0.8, 0.82, 0.86)) return true; // tray
  return false;
}

function isGlyph(u, v) {
  return isPin(u, v) || isArrow(u, v);
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
