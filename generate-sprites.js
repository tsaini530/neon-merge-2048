import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Simple CRC32 implementation
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4);
  data.copy(buf, 8);
  const crcTarget = buf.subarray(4, 8 + len);
  buf.writeUInt32BE(crc32(crcTarget), 8 + len);
  return buf;
}

function createPng(width, height, getPixelRgba) {
  // 8-byte PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 13 bytes
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // Deflate compression
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // No interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data: height scanlines, each (1 + width * 4) bytes
  const rowLen = 1 + width * 4;
  const raw = Buffer.alloc(rowLen * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    raw[rowOffset] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = getPixelRgba(x, y, width, height);
      raw[pixelOffset] = r;
      raw[pixelOffset + 1] = g;
      raw[pixelOffset + 2] = b;
      raw[pixelOffset + 3] = a;
    }
  }

  const idatCompressed = zlib.deflateSync(raw);
  const idatChunk = makeChunk('IDAT', idatCompressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const spriteDir = path.resolve('public/assets/sprites');
if (!fs.existsSync(spriteDir)) fs.mkdirSync(spriteDir, { recursive: true });

// 1. Neon Radial Glow texture (64x64)
const glowPng = createPng(64, 64, (x, y, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const dist = Math.hypot(x - cx, y - cy);
  const maxR = w / 2;
  if (dist >= maxR) return [0, 0, 0, 0];
  const factor = Math.pow(1 - dist / maxR, 2);
  const alpha = Math.floor(factor * 255);
  return [255, 255, 255, alpha];
});
fs.writeFileSync(path.join(spriteDir, 'particle_glow.png'), glowPng);

// 2. Neon Spark / Diamond Particle texture (32x32)
const sparkPng = createPng(32, 32, (x, y, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx + dy <= 12 || (dx <= 1 && dy <= 15) || (dy <= 1 && dx <= 15)) {
    const alpha = Math.floor(Math.max(0, 1 - (dx + dy) / 16) * 255);
    return [255, 255, 255, alpha];
  }
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(spriteDir, 'particle_spark.png'), sparkPng);

// 3. Cyber Tile Bevel Base texture (106x106)
const tilePng = createPng(106, 106, (x, y, w, h) => {
  const border = 4;
  const isBorder = x < border || x >= w - border || y < border || y >= h - border;
  if (isBorder) {
    return [0, 240, 255, 240];
  }
  return [10, 25, 45, 230];
});
fs.writeFileSync(path.join(spriteDir, 'tile_base.png'), tilePng);

console.log('Sprite PNG assets generated successfully in public/assets/sprites/');
