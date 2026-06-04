import { describe, expect, it } from "vitest";
import { buildServiceRequestInsightTags } from "../buildServiceRequestInsightTags";

describe("buildServiceRequestInsightTags", () => {
  it("returns empty when no insight fields", () => {
    expect(buildServiceRequestInsightTags({})).toEqual([]);
  });

  it("builds tags from urgency, complexity, duration, tags and warnings", () => {
    const items = buildServiceRequestInsightTags({
      urgency: "high",
      scopeComplexity: "medium",
      estimatedDurationHint: "1_day",
      tags: ["Tomada", "Cozinha"],
      missingInfoWarnings: ["Falta foto do quadro"],
    });
    expect(items.map((i) => i.label)).toEqual(
      expect.arrayContaining([
        "Urgente",
        "Escopo médio",
        "1 dia",
        "Tomada",
        "Cozinha",
        "Falta foto do quadro",
      ]),
    );
  });
});
