#!/usr/bin/env node
/**
 * Generates the ThinkNet application icon with no third-party dependency.
 *
 *   node scripts/make-icon.mjs
 *
 * Writes build/icon.ico (16/24/32/48 as bitmaps, 128/256 as PNG — electron-builder
 * rejects a Windows icon without a 256x256 frame) and build/icon.png.
 *
 * The mark is the product's own idea: a small feed-forward net on the same violet
 * gradient as the in-app logo. It is rasterised at 1024px and box-downsampled, which
 * is what keeps the 16px frame from looking jagged.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, "..", "build");

const MASTER = 1024;
const RADIUS = 0.22; // badge corner radius, as a fraction of the canvas
const FROM = [124, 108, 248]; // #7c6cf8
const TO = [90, 74, 224]; // #5a4ae0
const NODES = [
  [0.2, 0.26],
  [0.2, 0.5],
  [0.2, 0.74],
  [0.54, 0.34],
  [0.54, 0.66],
  [0.84, 0.5],
];
const EDGES = [
  [0, 3],
  [1, 3],
  [1, 4],
  [2, 4],
  [3, 5],
  [4, 5],
];
const NODE_R = 0.058;
const EDGE_W = 0.02;

/* ---------- geometry ---------- */

function sdRoundBox(x, y, half, radius) {
  const qx = Math.abs(x - half) - half + radius;
  const qy = Math.abs(y - half) - half + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function sdSegment(x, y, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = x - ax;
  const wy = y - ay;
  const t = Math.min(1, Math.max(0, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(wx - vx * t, wy - vy * t);
}

/** 1 inside, 0 outside, with a one-pixel ramp for antialiasing. */
function coverage(signedDistance, aa) {
  return Math.min(1, Math.max(0, 0.5 - signedDistance / aa));
}

function renderMaster() {
  const size = MASTER;
  const half = size / 2;
  const px = (unit) => unit * size;
  const aa = size / MASTER;
  const nodes = NODES.map(([x, y]) => [px(x), px(y)]);
  const buffer = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const badge = coverage(sdRoundBox(x, y, half, px(RADIUS)), aa);
      if (badge <= 0) continue;

      const t = (x + y) / (2 * size);
      let r = FROM[0] + (TO[0] - FROM[0]) * t;
      let g = FROM[1] + (TO[1] - FROM[1]) * t;
      let b = FROM[2] + (TO[2] - FROM[2]) * t;

      let ink = 0;
      for (const [a, c] of EDGES) {
        ink = Math.max(
          ink,
          coverage(sdSegment(x, y, nodes[a][0], nodes[a][1], nodes[c][0], nodes[c][1]) - px(EDGE_W) / 2, aa),
        );
      }
      for (const [nx, ny] of nodes) {
        ink = Math.max(ink, coverage(Math.hypot(x - nx, y - ny) - px(NODE_R), aa));
      }

      r += (255 - r) * ink;
      g += (255 - g) * ink;
      b += (255 - b) * ink;

      const at = (y * size + x) * 4;
      buffer[at] = r;
      buffer[at + 1] = g;
      buffer[at + 2] = b;
      buffer[at + 3] = badge * 255;
    }
  }
  return buffer;
}

function downsample(source, from, to) {
  if (to === from) return source;
  const ratio = from / to;
  const out = new Uint8ClampedArray(to * to * 4);
  for (let y = 0; y < to; y += 1) {
    for (let x = 0; x < to; x += 1) {
      const x0 = Math.floor(x * ratio);
      const x1 = Math.min(from, Math.max(x0 + 1, Math.ceil((x + 1) * ratio)));
      const y0 = Math.floor(y * ratio);
      const y1 = Math.min(from, Math.max(y0 + 1, Math.ceil((y + 1) * ratio)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const at = (sy * from + sx) * 4;
          // Premultiply so the transparent corners do not bleed their colour inward.
          const alpha = source[at + 3] / 255;
          r += source[at] * alpha;
          g += source[at + 1] * alpha;
          b += source[at + 2] * alpha;
          a += alpha;
          n += 1;
        }
      }
      const alpha = a / n;
      const at = (y * to + x) * 4;
      if (alpha <= 0) continue;
      out[at] = (r / n) / alpha;
      out[at + 1] = (g / n) / alpha;
      out[at + 2] = (b / n) / alpha;
      out[at + 3] = alpha * 255;
    }
  }
  return out;
}

/* ---------- encoders ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0 ^ -1;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(tag, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tag, "ascii"), data])));
  return Buffer.concat([length, Buffer.from(tag, "ascii"), data, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy ? rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride) : Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Classic 32bpp DIB entry, kept for the small frames where PNG-in-ICO is flaky. */
function encodeDib(size, rgba) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // two masks: colours + AND
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const maskStride = Math.ceil(size / 32) * 4;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const source = (size - 1 - y) * size * 4; // DIB rows are bottom-up
    for (let x = 0; x < size; x += 1) {
      const at = (y * size + x) * 4;
      const alpha = rgba[source + x * 4 + 3] / 255;
      pixels[at] = rgba[source + x * 4 + 2] * alpha; // B, straight alpha
      pixels[at + 1] = rgba[source + x * 4 + 1] * alpha;
      pixels[at + 2] = rgba[source + x * 4] * alpha;
      pixels[at + 3] = rgba[source + x * 4 + 3];
    }
  }
  return Buffer.concat([header, pixels, Buffer.alloc(maskStride * size)]);
}

function encodeIco(frames) {
  const count = frames.length;
  const head = Buffer.alloc(6 + count * 16);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(count, 4);
  let offset = head.length;
  frames.forEach((frame, index) => {
    const at = 6 + index * 16;
    head[at] = frame.size === 256 ? 0 : frame.size;
    head[at + 1] = frame.size === 256 ? 0 : frame.size;
    head.writeUInt16LE(1, at + 4); // planes
    head.writeUInt16LE(32, at + 6); // bpp
    head.writeUInt32LE(frame.data.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += frame.data.length;
  });
  return Buffer.concat([head, ...frames.map((frame) => frame.data)]);
}

/* ---------- main ---------- */

fs.mkdirSync(OUT_DIR, { recursive: true });
const master = renderMaster();

const frames = [16, 24, 32, 48, 128, 256].map((size) => {
  const rgba = Buffer.from(downsample(master, MASTER, size).buffer);
  // Windows reads 16-48 best as bitmaps; the large frames stay PNG to keep the file small.
  const data = size <= 48 ? encodeDib(size, rgba) : encodePng(size, rgba);
  return { size, data };
});

const iconPath = path.join(OUT_DIR, "icon.ico");
const pngPath = path.join(OUT_DIR, "icon.png");
fs.writeFileSync(iconPath, encodeIco(frames));
fs.writeFileSync(pngPath, frames[frames.length - 1].data);

console.log(`${iconPath} (${frames.map((frame) => frame.size).join(", ")})`);
console.log(`${pngPath} 256x256`);
