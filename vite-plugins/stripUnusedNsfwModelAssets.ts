import { existsSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * nsfwjs ships MobileNetV2, MobileNetV2Mid, and InceptionV3 as separate dynamic chunks.
 * We only call load("MobileNetV2"), so the other model assets are never fetched at runtime
 * but still land in dist and in the PWA precache manifest. Remove them after Rollup emits.
 */
export function stripUnusedNsfwModelAssets(distDir = "dist"): Plugin {
  return {
    name: "strip-unused-nsfw-model-assets",
    apply: "build",
    closeBundle() {
      const assetsDir = path.resolve(process.cwd(), distDir, "assets");
      if (!existsSync(assetsDir)) return;

      for (const name of readdirSync(assetsDir)) {
        if (!name.endsWith(".js") && !name.endsWith(".js.map")) continue;

        const remove =
          /inception/i.test(name) ||
          /mobilenet_v2_mid/i.test(name) ||
          /group1-shard\d+of2\./i.test(name) ||
          /group1-shard\d+of6\./i.test(name);

        if (remove) {
          unlinkSync(path.join(assetsDir, name));
        }
      }

      // Rollup may still emit model.min-* chunks for removed models; delete if unreferenced.
      const jsNames = readdirSync(assetsDir).filter(
        (n) => n.endsWith(".js") && !n.endsWith(".js.map")
      );
      const referencedFrom = jsNames
        .filter((n) => !n.startsWith("model.min-"))
        .map((n) => readFileSync(path.join(assetsDir, n), "utf8"))
        .join("\n");
      for (const name of jsNames) {
        if (!name.startsWith("model.min-")) continue;
        if (referencedFrom.includes(name)) continue;
        const full = path.join(assetsDir, name);
        unlinkSync(full);
        const mapFile = `${full}.map`;
        if (existsSync(mapFile)) unlinkSync(mapFile);
      }
    },
  };
}
