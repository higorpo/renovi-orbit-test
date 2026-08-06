/**
 * Import-boundary contract (Task 53): view-services consumes completion UX
 * only via @/features/service-completion Public API — no payments lifecycle
 * writers and no local mark/confirm re-export modules.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const FEATURE_ROOT = join(process.cwd(), "src/features/view-services");

const FORBIDDEN_SUBSTRINGS = [
  "payment_mark_service_executed",
  "payment_confirm_service_completed",
  "markServiceExecuted.api",
  "confirmServiceCompleted.api",
  "useMarkServiceExecuted",
  "useConfirmServiceCompleted",
  "ServiceCompletionActions",
  "mapServiceCompletionError",
] as const;

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("view-services service-completion cutover boundary", () => {
  it("does not reintroduce payments completion writers or local lifecycle wrappers", () => {
    const files = listSourceFiles(FEATURE_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      // This boundary test file itself documents forbidden tokens.
      if (file.endsWith("serviceCompletionImportBoundary.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const token of FORBIDDEN_SUBSTRINGS) {
        if (text.includes(token)) {
          violations.push(`${relative(FEATURE_ROOT, file)} → ${token}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("imports completion UX from service-completion Public API in detail surfaces", () => {
    const contracted = readFileSync(
      join(FEATURE_ROOT, "components/ServiceContractedSection.tsx"),
      "utf8",
    );

    expect(contracted).toMatch(/from ["']@\/features\/service-completion["']/);
    expect(contracted).toMatch(/ProviderMarkExecutedAction/);
    expect(contracted).toMatch(/ClientEvaluateServiceAction/);
  });

  it("does not export mark/confirm lifecycle from view-services Public API", () => {
    const barrel = readFileSync(join(FEATURE_ROOT, "index.ts"), "utf8");
    expect(barrel).not.toMatch(/markServiceExecuted/);
    expect(barrel).not.toMatch(/confirmServiceCompleted/);
    expect(barrel).not.toMatch(/useMarkServiceExecuted/);
    expect(barrel).not.toMatch(/useConfirmServiceCompleted/);
    expect(barrel).not.toMatch(/ServiceCompletionActions/);
  });
});
