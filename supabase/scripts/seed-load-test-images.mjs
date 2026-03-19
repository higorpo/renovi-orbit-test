#!/usr/bin/env node
/**
 * Uploads placeholder images to Supabase Storage for the load-test seed data.
 *
 * Run AFTER executing seed-load-test.sql.
 * Requires: local Supabase running (npx supabase start).
 *
 * Usage:
 *   nvm use 24.13 && node supabase/scripts/seed-load-test-images.mjs
 *   nvm use 24.13 && node supabase/scripts/seed-load-test-images.mjs --picsum   # real photos (needs internet)
 */

import { execSync } from "node:child_process";
import { deflateSync } from "node:zlib";

// ─── CRC32 (required for PNG chunk checksums) ──────────────────────────────

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++)
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── Minimal PNG generator ─────────────────────────────────────────────────

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, c]);
}

function createGradientPng(w, h, r, g, b, seed = 0) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // 8-bit RGB

  const rowBytes = 1 + w * 3;
  const raw = Buffer.alloc(h * rowBytes);

  // Seed shifts the gradient angle for visual variety across images in the same slot
  const angle = (seed * 37) % 360;
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);

  for (let y = 0; y < h; y++) {
    const off = y * rowBytes;
    raw[off] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const ny = y / h;
      const t = Math.abs(nx * dx + ny * dy);
      const f = 1 - t * 0.45;
      const px = off + 1 + x * 3;
      raw[px] = Math.min(255, Math.max(0, Math.floor(r * f)));
      raw[px + 1] = Math.min(255, Math.max(0, Math.floor(g * f)));
      raw[px + 2] = Math.min(255, Math.max(0, Math.floor(b * f)));
    }
  }

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Supabase connection ───────────────────────────────────────────────────

function getSupabaseInfo() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }
  try {
    const raw = execSync("npx supabase status --output json", {
      encoding: "utf-8",
      timeout: 30_000,
    });
    const json = JSON.parse(raw.slice(raw.indexOf("{")));
    const url = json.API_URL;
    const key = json.SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("parse_failed");
    return { url, key };
  } catch {
    throw new Error(
      "Could not get Supabase connection info.\n" +
        "Make sure Supabase is running (npx supabase start) or set\n" +
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }
}

// ─── Image manifest (mirrors seed-load-test.sql photo paths) ───────────────

const CLIENT_IDS = [
  "1a000001-0000-4000-a000-000000000001",
  "1a000001-0000-4000-a000-000000000002",
  "1a000001-0000-4000-a000-000000000003",
  "1a000001-0000-4000-a000-000000000004",
  "1a000001-0000-4000-a000-000000000005",
  "1a000001-0000-4000-a000-000000000006",
  "1a000001-0000-4000-a000-000000000007",
  "1a000001-0000-4000-a000-000000000008",
  "1a000001-0000-4000-a000-000000000009",
  "1a000001-0000-4000-a000-00000000000a",
  "1a000001-0000-4000-a000-00000000000b",
  "1a000001-0000-4000-a000-00000000000c",
  "1a000001-0000-4000-a000-00000000000d",
  "1a000001-0000-4000-a000-00000000000e",
  "1a000001-0000-4000-a000-00000000000f",
];

// Slot colors (RGB) — each service type has a distinct palette
const SLOT_COLORS = {
  1: [245, 158, 11], // Warm yellow — tomadas
  2: [249, 115, 22], // Orange — quadro elétrico
  3: [56, 189, 248], // Sky blue — AC instalação
  4: [16, 185, 129], // Emerald — hidráulica
  5: [217, 119, 6], // Amber — reforma elétrica
  6: [125, 211, 252], // Light blue — AC limpeza
  7: [20, 184, 166], // Teal — acessório
  8: [234, 179, 8], // Yellow — iluminação
  9: [129, 140, 248], // Indigo — AC troca
  10: [251, 113, 133], // Rose — pintura
};

function buildImageList() {
  const images = [];

  for (let i = 0; i < 15; i++) {
    const cid = CLIENT_IDS[i];
    const ci = i + 1; // 1-based (matches SQL loop variable)

    // Slot 1: always 2 photos
    images.push({ slot: 1, path: `${cid}/1710000010_0.jpg`, seed: i });
    images.push({ slot: 1, path: `${cid}/1710000010_1.jpg`, seed: i + 15 });

    // Slot 2: always 1 photo
    images.push({ slot: 2, path: `${cid}/1710000020_0.jpg`, seed: i + 30 });

    // Slot 3: always 3 photos
    images.push({ slot: 3, path: `${cid}/1710000030_0.jpg`, seed: i + 45 });
    images.push({ slot: 3, path: `${cid}/1710000030_1.jpg`, seed: i + 60 });
    images.push({ slot: 3, path: `${cid}/1710000030_2.jpg`, seed: i + 75 });

    // Slot 4: 2 photos only when ci % 3 === 0 (clients 3, 6, 9, 12, 15)
    if (ci % 3 === 0) {
      images.push({ slot: 4, path: `${cid}/1710000040_0.jpg`, seed: i + 90 });
      images.push({
        slot: 4,
        path: `${cid}/1710000040_1.jpg`,
        seed: i + 105,
      });
    }

    // Slot 5: always 2 photos
    images.push({ slot: 5, path: `${cid}/1710000050_0.jpg`, seed: i + 120 });
    images.push({
      slot: 5,
      path: `${cid}/1710000050_1.jpg`,
      seed: i + 135,
    });

    // Slot 6: 1 photo only when ci % 2 === 0 (clients 2, 4, 6, 8, 10, 12, 14)
    if (ci % 2 === 0) {
      images.push({
        slot: 6,
        path: `${cid}/1710000060_0.jpg`,
        seed: i + 150,
      });
    }

    // Slot 7: always 3 photos
    images.push({ slot: 7, path: `${cid}/1710000070_0.jpg`, seed: i + 165 });
    images.push({
      slot: 7,
      path: `${cid}/1710000070_1.jpg`,
      seed: i + 180,
    });
    images.push({
      slot: 7,
      path: `${cid}/1710000070_2.jpg`,
      seed: i + 195,
    });

    // Slot 8: always 1 photo
    images.push({ slot: 8, path: `${cid}/1710000080_0.jpg`, seed: i + 210 });

    // Slot 9: 2 photos only when ci % 3 === 0 (clients 3, 6, 9, 12, 15)
    if (ci % 3 === 0) {
      images.push({
        slot: 9,
        path: `${cid}/1710000090_0.jpg`,
        seed: i + 225,
      });
      images.push({
        slot: 9,
        path: `${cid}/1710000090_1.jpg`,
        seed: i + 240,
      });
    }

    // Slot 10: always 3 photos
    images.push({
      slot: 10,
      path: `${cid}/1710000100_0.jpg`,
      seed: i + 255,
    });
    images.push({
      slot: 10,
      path: `${cid}/1710000100_1.jpg`,
      seed: i + 270,
    });
    images.push({
      slot: 10,
      path: `${cid}/1710000100_2.jpg`,
      seed: i + 285,
    });
  }

  return images;
}

// ─── Upload ────────────────────────────────────────────────────────────────

async function upload(supabaseUrl, serviceKey, bucket, path, body, ct) {
  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": ct,
        "x-upsert": "true",
      },
      body,
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed for ${path}: ${res.status} — ${text}`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

const BUCKET = "service-requests";
const IMG_W = 400;
const IMG_H = 300;
const BATCH_SIZE = 10;

async function main() {
  const usePicsum = process.argv.includes("--picsum");

  console.log("Connecting to local Supabase...");
  const { url, key } = getSupabaseInfo();
  console.log(`  API URL: ${url}\n`);

  const images = buildImageList();
  console.log(
    `Will upload ${images.length} images to bucket "${BUCKET}".\n`,
  );

  // ── Generate or download images ──────────────────────────────────────

  /** @type {Map<string, { buf: Buffer, ct: string }>} keyed by `slot-seed` */
  const cache = new Map();

  if (usePicsum) {
    console.log("Mode: --picsum (downloading real photos from picsum.photos)");
    // Download one unique image per slot (10 total) for speed
    for (let slot = 1; slot <= 10; slot++) {
      process.stdout.write(`  Downloading slot ${slot}/10 image...`);
      const res = await fetch(
        `https://picsum.photos/seed/loadtest-${slot}/800/600`,
      );
      if (!res.ok) throw new Error(`picsum.photos returned ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      cache.set(`picsum-${slot}`, { buf, ct: "image/jpeg" });
      console.log(` done (${(buf.length / 1024).toFixed(0)} KB)`);
    }
  } else {
    console.log("Mode: offline (generating gradient PNGs locally)");
    // Each image gets a unique gradient angle via its seed
    for (const img of images) {
      const cacheKey = `${img.slot}-${img.seed}`;
      if (!cache.has(cacheKey)) {
        const [r, g, b] = SLOT_COLORS[img.slot];
        cache.set(cacheKey, {
          buf: createGradientPng(IMG_W, IMG_H, r, g, b, img.seed),
          ct: "image/png",
        });
      }
    }
    console.log(`  Generated ${cache.size} unique gradient images.`);
  }

  // ── Upload in parallel batches ───────────────────────────────────────

  console.log("");
  let done = 0;
  const total = images.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (img) => {
        const cacheKey = usePicsum
          ? `picsum-${img.slot}`
          : `${img.slot}-${img.seed}`;
        const { buf, ct } = cache.get(cacheKey);
        await upload(url, key, BUCKET, img.path, buf, ct);
        done++;
      }),
    );
    process.stdout.write(`\r  Uploaded ${done}/${total}`);
  }

  console.log(
    `\n\nDone! ${total} images uploaded to "${BUCKET}" bucket.`,
  );
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
