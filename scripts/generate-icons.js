// scripts/generate-icons.js
// 生成 PWA 应用图标（无第三方依赖，仅用 Node 内置 zlib 编码 PNG）
// 用法: node scripts/generate-icons.js
// 产物: icons/icon-512.png, icon-192.png, icon-180.png, icon-152.png, icon-120.png

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- PNG 编码 ----------
// CRC32 表
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // color type: RGBA
  // 每行前加 filter 字节 0
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 绘制 ----------
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

// scale: 整体缩放（1 = 满版；0.8 = maskable 安全区留白版）
function pixelColor(x, y, N, scale) {
  const cx = N / 2;
  const cy = N / 2;
  const tomatoR = N * 0.30 * scale;
  const tomatoCy = cy + N * 0.03 * scale;   // 番茄中心略偏下，给叶子留空间

  // 番茄主体（红色圆形）
  const dx = x - cx;
  const dy = y - tomatoCy;
  const inTomato = dx * dx + dy * dy <= tomatoR * tomatoR;

  // 番茄高光（左上小椭圆）
  const hlR = N * 0.085 * scale;
  const hlDx = x - (cx - N * 0.11 * scale);
  const hlDy = y - (tomatoCy - N * 0.13 * scale);
  const inHighlight = hlDx * hlDx + hlDy * hlDy <= hlR * hlR;

  // 叶子（三个小圆瓣）+ 果柄
  const leafR = N * 0.115 * scale;
  const leafTopCy = tomatoCy - tomatoR * 0.98;
  const petals = [
    [cx - N * 0.105 * scale, leafTopCy - N * 0.005 * scale],
    [cx,                     leafTopCy - N * 0.095 * scale],
    [cx + N * 0.105 * scale, leafTopCy - N * 0.005 * scale],
  ];
  const inLeaf = petals.some(([lx, ly]) => (x - lx) ** 2 + (y - ly) ** 2 <= leafR * leafR);
  const inStem = Math.abs(x - cx) <= N * 0.014 * scale && y <= leafTopCy - N * 0.02 * scale && y >= leafTopCy - N * 0.17 * scale;

  // 背景：主题紫竖直渐变 #8b5cf6 → #6d28d9
  const t = y / N;
  const bg = [lerp(139, 109, t), lerp(92, 40, t), lerp(246, 217, t)];

  if (inStem) return [21, 128, 61, 255];            // #15803d 深绿
  if (inLeaf) return [34, 197, 94, 255];            // #22c55e 绿
  if (inTomato) return inHighlight ? [255, 205, 205, 255] : [239, 68, 68, 255]; // 高亮/红 #ef4444
  return [bg[0], bg[1], bg[2], 255];
}

function draw(size, scale = 1) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelColor(x, y, size, scale);
      const i = (y * size + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    }
  }
  return encodePNG(size, rgba);
}

// ---------- 输出 ----------
const SIZES = [512, 192, 180, 152, 120];
const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of SIZES) {
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, draw(size));
  console.log(`✓ ${path.relative(process.cwd(), file)} (${size}x${size})`);
}

// maskable 版：图形缩至中心 80% 安全区内，避免被系统裁边
const maskableFile = path.join(outDir, 'icon-maskable-512.png');
fs.writeFileSync(maskableFile, draw(512, 0.78));
console.log(`✓ ${path.relative(process.cwd(), maskableFile)} (512x512, maskable)`);

console.log('图标生成完成');
