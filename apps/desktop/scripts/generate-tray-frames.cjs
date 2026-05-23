// Generate the animated menu-bar (Tray) icon frames for Rich.
//
// Mascot: a tiny Transformer-style figure. Full loop is 16 frames:
//
//   0–3:   Walk cycle (left step → neutral → right step → neutral)
//   4:     Brace — stop, planted feet
//   5–8:   Transformation step 1–4 — arms fold, head retracts, body
//          tilts horizontal, wheels deploy. Each step is a clear
//          mechanical pose so the eye reads the segmentation.
//   9–10:  Drive — wheel spokes rotate
//  11:     Brake — wheels lock, hint of vertical lift
//  12–15:  Reverse transformation — wheels detach, body rises,
//          head emerges, arms extend back out
//
// Per-frame durations are stored in `FRAME_MS` and exported for the main
// process so walk frames flick fast (~160 ms) while transform frames
// linger (~300 ms) like a real Transformer's mechanical sequence.
//
// Constraints: pure JS, no external deps. PNG color type 4 (gray+alpha);
// gray = 0, alpha carries the silhouette so macOS template image system
// can tint to menu-bar foreground color.

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

// ----- PNG encoder -------------------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, c]);
}
function encodePNG(width, height, grayAlphaPairs) {
  const stride = width * 2;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + stride)] = 0;
    for (let i = 0; i < stride; i++) {
      raw[y * (1 + stride) + 1 + i] = grayAlphaPairs[y * stride + i];
    }
  }
  const idat = zlib.deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 4; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ----- Pixel primitives --------------------------------------------------
const SZ = 22;
const set = (b, x, y, a = 255) => {
  if (x < 0 || x >= SZ || y < 0 || y >= SZ) return;
  if (b[y * SZ + x] < a) b[y * SZ + x] = a;
};
const clear = (b, x, y) => {
  if (x < 0 || x >= SZ || y < 0 || y >= SZ) return;
  b[y * SZ + x] = 0;
};
const rect = (b, x, y, w, h, a = 255) => {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) set(b, x + dx, y + dy, a);
};
const eraseR = (b, x, y, w, h) => {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) clear(b, x + dx, y + dy);
};
const disc = (b, cx, cy, r, a = 255) => {
  const rr = (r + 0.5) * (r + 0.5);
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
    if (x * x + y * y <= rr) set(b, cx + x, cy + y, a);
};

// ----- Sub-component drawers --------------------------------------------
/** Head with antenna + two eye holes. yOff lets it dip during transform. */
function drawHead(b, yOff = 0, withAntenna = true) {
  if (withAntenna) rect(b, 10, 1 + yOff, 2, 2);
  rect(b, 7, 3 + yOff, 8, 4);
  eraseR(b, 9, 4 + yOff, 1, 1);
  eraseR(b, 12, 4 + yOff, 1, 1);
}

/** Torso block, centered. Width parameter controls how wide it spreads
 *  during transformation (robot=10, car=18). */
function drawTorso(b, y, w, h) {
  const x = Math.floor((SZ - w) / 2);
  rect(b, x, y, w, h);
}

// ----- Keyframes ---------------------------------------------------------
/** Walking robot. `step` ∈ {-1, 0, +1}:
 *  -1 = left foot planted forward, right foot lifting
 *   0 = both feet on ground, neutral
 *  +1 = right foot planted forward, left foot lifting */
function robotWalk(b, step) {
  const bob = step === 0 ? 0 : 1; // body bobs down 1px on contact
  drawHead(b, bob, true);
  drawTorso(b, 7 + bob, 10, 5);
  // Pelvis band — slightly visible
  rect(b, 6, 12 + bob, 10, 1);

  if (step === 0) {
    // Both legs straight down, arms hanging straight
    rect(b, 3, 8 + bob, 3, 4);
    rect(b, 16, 8 + bob, 3, 4);
    rect(b, 7, 13 + bob, 3, 6);
    rect(b, 12, 13 + bob, 3, 6);
    rect(b, 5, 19 + bob, 5, 2);
    rect(b, 12, 19 + bob, 5, 2);
  } else if (step === -1) {
    // Left foot forward, right foot lifted behind
    // Arms swing opposite — right arm forward, left arm back
    rect(b, 3, 7 + bob, 2, 5);   // left arm pulled back (higher origin)
    rect(b, 4, 11 + bob, 2, 2);  // left arm hand
    rect(b, 17, 9 + bob, 3, 4);  // right arm forward
    // Legs
    rect(b, 6, 13 + bob, 3, 6);   // left leg planted (slightly forward)
    rect(b, 13, 13 + bob, 3, 4);  // right leg shorter (lifted)
    rect(b, 4, 19 + bob, 5, 2);   // left foot forward & flat
    rect(b, 13, 17 + bob, 4, 2);  // right foot up (raised, smaller)
  } else /* step === +1 */ {
    rect(b, 2, 9 + bob, 3, 4);   // left arm forward
    rect(b, 17, 7 + bob, 2, 5);  // right arm back
    rect(b, 17, 11 + bob, 2, 2); // right arm hand
    rect(b, 6, 13 + bob, 3, 4);   // left leg shorter (lifted)
    rect(b, 13, 13 + bob, 3, 6);  // right leg planted
    rect(b, 5, 17 + bob, 4, 2);   // left foot up
    rect(b, 13, 19 + bob, 5, 2);  // right foot forward & flat
  }
}

/** Brace — robot stops, feet planted shoulder-width, arms beginning to
 *  lower. This is the visual "click" before transformation kicks off. */
function robotBrace(b) {
  drawHead(b, 0, true);
  drawTorso(b, 7, 10, 5);
  rect(b, 6, 12, 10, 1);
  // Arms slightly out (preparing)
  rect(b, 3, 8, 3, 5);
  rect(b, 16, 8, 3, 5);
  // Feet planted wider
  rect(b, 6, 13, 3, 6);
  rect(b, 13, 13, 3, 6);
  rect(b, 4, 19, 6, 2);
  rect(b, 12, 19, 6, 2);
}

/** Transform step 1 — antenna folds, arms snap down flush against body,
 *  head tilts slightly back. The first "kachuck". */
function tx1(b) {
  // Antenna gone
  rect(b, 7, 3, 8, 4);
  eraseR(b, 9, 4, 1, 1);
  eraseR(b, 12, 4, 1, 1);
  // Torso slightly wider
  drawTorso(b, 7, 12, 5);
  // Arms locked down to sides (now flush with torso)
  rect(b, 4, 7, 2, 6);
  rect(b, 16, 7, 2, 6);
  // Legs together
  rect(b, 8, 13, 3, 6);
  rect(b, 11, 13, 3, 6);
  // Feet narrower (preparing to fold)
  rect(b, 7, 19, 4, 2);
  rect(b, 11, 19, 4, 2);
}

/** Transform step 2 — head retracts down into chest, body widens further,
 *  legs bend at knees pulling up. */
function tx2(b) {
  // Vestigial head bump
  rect(b, 8, 6, 6, 3);
  eraseR(b, 9, 7, 1, 1);
  eraseR(b, 12, 7, 1, 1);
  // Wide torso
  drawTorso(b, 9, 16, 5);
  // Arm stubs flush
  rect(b, 2, 11, 2, 3);
  rect(b, 18, 11, 2, 3);
  // Knees pulled up — legs are folded "Z" shape
  rect(b, 7, 15, 3, 3);
  rect(b, 12, 15, 3, 3);
  // Feet flat (about to become wheels)
  rect(b, 6, 18, 4, 2);
  rect(b, 12, 18, 4, 2);
}

/** Transform step 3 — head fully gone, body fully horizontal slab, leg
 *  joints rotating outward to become wheel pylons. */
function tx3(b) {
  // No head — fully merged
  // Horizontal slab body
  rect(b, 3, 10, 16, 5);
  // Side knuckle joints
  rect(b, 2, 13, 3, 4);
  rect(b, 17, 13, 3, 4);
  // Wheel pylons starting to form (square-ish, not circles yet — that's the
  // "mid-rotation" mechanical pose)
  rect(b, 3, 16, 4, 3);
  rect(b, 15, 16, 4, 3);
}

/** Transform step 4 — cabin pops up, wheels click into final round form. */
function tx4(b) {
  // Lower body
  rect(b, 3, 11, 16, 5);
  // Cabin nub appears
  rect(b, 7, 8, 8, 3);
  // Wheels — now round
  disc(b, 5, 17, 2);
  disc(b, 16, 17, 2);
}

/** Final car form. `roll` ∈ {0,1,2,3} — wheel spoke position so the
 *  driving frames read as rotation. */
function car(b, roll) {
  // Main body
  rect(b, 2, 12, 18, 5);
  // Cabin
  rect(b, 6, 8, 10, 4);
  // Window strip
  eraseR(b, 7, 9, 8, 2);
  // Front/back bevels
  rect(b, 4, 11, 3, 1);
  rect(b, 15, 11, 3, 1);
  // Wheels (radius 2)
  disc(b, 5, 17, 2);
  disc(b, 16, 17, 2);
  // Spoke highlight (one pixel inside the wheel, rotating)
  const spokes = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const [sx, sy] = spokes[roll % 4];
  clear(b, 5 + sx, 17 + sy);
  clear(b, 16 + sx, 17 + sy);
}

// ----- 16-frame sequence -------------------------------------------------
const FRAMES = [
  // Walk cycle
  (b) => robotWalk(b, -1),   // 0  step left
  (b) => robotWalk(b, 0),    // 1  neutral
  (b) => robotWalk(b, +1),   // 2  step right
  (b) => robotWalk(b, 0),    // 3  neutral
  // Brace
  (b) => robotBrace(b),      // 4  stop, plant
  // Transformation (4 mechanical steps)
  (b) => tx1(b),             // 5  arms down, antenna in
  (b) => tx2(b),             // 6  head retracts
  (b) => tx3(b),             // 7  body horizontal
  (b) => tx4(b),             // 8  cabin & wheels click in
  // Drive
  (b) => car(b, 0),          // 9  car, spoke top
  (b) => car(b, 1),          // 10 car, spoke right
  (b) => car(b, 2),          // 11 car, spoke bottom
  // Reverse — play transformation backward
  (b) => tx4(b),             // 12 wheels detaching
  (b) => tx3(b),             // 13 body lifting
  (b) => tx2(b),             // 14 head emerging
  (b) => tx1(b),             // 15 arms extending — back to standing next loop
];

// Per-frame durations (ms) — walk fast, transform slow & mechanical.
const FRAME_MS = [
  160, 140, 160, 140,        // walk cycle — brisk
  280,                       // brace — pause
  300, 320, 320, 300,        // transformation — "ka-chunk ka-chunk"
  180, 180, 180,             // drive — moderate
  300, 320, 320, 300,        // reverse transformation
];

// ----- Render & write ----------------------------------------------------
function renderBase(idx) {
  const alpha = new Uint8Array(SZ * SZ);
  FRAMES[idx](alpha);
  const pair = new Uint8Array(SZ * SZ * 2);
  for (let i = 0; i < alpha.length; i++) {
    pair[i * 2] = 0;
    pair[i * 2 + 1] = alpha[i];
  }
  return pair;
}
function upscale2x(src) {
  const dstSZ = SZ * 2;
  const dst = new Uint8Array(dstSZ * dstSZ * 2);
  for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
    const s = (y * SZ + x) * 2;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const d = ((y * 2 + dy) * dstSZ + x * 2 + dx) * 2;
      dst[d] = src[s];
      dst[d + 1] = src[s + 1];
    }
  }
  return dst;
}

const outDir = path.resolve(__dirname, "..", "assets", "tray");
fs.mkdirSync(outDir, { recursive: true });
for (let i = 0; i < FRAMES.length; i++) {
  const base = renderBase(i);
  fs.writeFileSync(path.join(outDir, `frame-${i}.png`), encodePNG(SZ, SZ, base));
  fs.writeFileSync(path.join(outDir, `frame-${i}@2x.png`), encodePNG(SZ * 2, SZ * 2, upscale2x(base)));
}
// Write the per-frame timing alongside the PNGs so main.ts can load it
// instead of hardcoding a duplicate copy.
fs.writeFileSync(
  path.join(outDir, "timing.json"),
  JSON.stringify({ frames: FRAMES.length, durationsMs: FRAME_MS }, null, 2),
);
console.log(`generated ${FRAMES.length} Transformer mascot frames + timing.json in ${outDir}`);
