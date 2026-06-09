#!/usr/bin/env node
/**
 * Uploads placeholder images for supabase/seed.sql service_requests.
 *
 * Run AFTER yarn db:reset (seed.sql sets photos paths; this script uploads files).
 * Requires local Supabase running (npx supabase start).
 *
 * Usage:
 *   nvm use 24.13 && yarn seed:dev-images
 *   nvm use 24.13 && yarn seed:dev-images-real   # picsum.photos (needs internet)
 */

import { execSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { SEED_DEV_IMAGES } from "./seed-dev-images.manifest.mjs";

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
  ihdr[9] = 2;

  const rowBytes = 1 + w * 3;
  const raw = Buffer.alloc(h * rowBytes);
  const angle = (seed * 37) % 360;
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);

  for (let y = 0; y < h; y++) {
    const off = y * rowBytes;
    raw[off] = 0;
    for (let x = 0; x < w; x++) {
      const t = Math.abs((x / w) * dx + (y / h) * dy);
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

function getSupabaseInfo() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }
  const raw = execSync("npx supabase status --output json", {
    encoding: "utf-8",
    timeout: 30_000,
  });
  const json = JSON.parse(raw.slice(raw.indexOf("{")));
  const url = json.API_URL;
  const key = json.SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Could not parse Supabase status JSON.");
  }
  return { url, key };
}

async function upload(supabaseUrl, serviceKey, bucket, path, body, contentType) {
  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": contentType,
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

const BUCKET = "service-requests";
const IMG_W = 640;
const IMG_H = 480;
const BATCH_SIZE = 10;

const SLOT_COLORS = {
  1: [245, 158, 11],
  2: [249, 115, 22],
  3: [56, 189, 248],
  5: [217, 119, 6],
  8: [234, 179, 8],
};

async function main() {
  const usePicsum = process.argv.includes("--picsum");
  console.log("Connecting to local Supabase...");
  const { url, key } = getSupabaseInfo();
  console.log(`  API URL: ${url}\n`);

  const images = SEED_DEV_IMAGES;
  console.log(`Will upload ${images.length} images to bucket "${BUCKET}".\n`);

  const cache = new Map();

  if (usePicsum) {
    console.log("Mode: --picsum (downloading photos from picsum.photos)");
    const slots = [...new Set(images.map((img) => img.slot))];
    for (const slot of slots) {
      process.stdout.write(`  Downloading slot ${slot}...`);
      const res = await fetch(
        `https://picsum.photos/seed/orbit-dev-${slot}/800/600`,
      );
      if (!res.ok) throw new Error(`picsum.photos returned ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      cache.set(`picsum-${slot}`, { buf, ct: "image/jpeg" });
      console.log(` done (${(buf.length / 1024).toFixed(0)} KB)`);
    }
  } else {
    console.log("Mode: offline (generating gradient PNGs locally)");
    for (const img of images) {
      const cacheKey = `${img.slot}-${img.seed}`;
      if (cache.has(cacheKey)) continue;
      const [r, g, b] = SLOT_COLORS[img.slot] ?? [148, 163, 184];
      cache.set(cacheKey, {
        buf: createGradientPng(IMG_W, IMG_H, r, g, b, img.seed),
        ct: "image/png",
      });
    }
    console.log(`  Generated ${cache.size} unique gradient images.`);
  }

  console.log("");
  let done = 0;
  for (let i = 0; i < images.length; i += BATCH_SIZE) {
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
    process.stdout.write(`\r  Uploaded ${done}/${images.length}`);
  }

  console.log(`\n\nDone! ${images.length} images uploaded to "${BUCKET}".`);
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
