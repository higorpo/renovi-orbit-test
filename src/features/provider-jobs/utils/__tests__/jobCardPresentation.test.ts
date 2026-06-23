import { describe, expect, it } from "vitest";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";
import { getJobCardPresentation } from "../jobCardPresentation";

describe("getJobCardPresentation", () => {
  it("builds location line with neighborhood and distance", () => {
    const presentation = getJobCardPresentation(
      createMinimalJob({
        distance_km: 2.5,
        neighborhood: "Centro",
      }),
    );

    expect(presentation.locationLine).toContain("Centro");
    expect(presentation.locationLine).toMatch(/de você/i);
  });

  it("builds location line with neighborhood only when distance is unavailable", () => {
    const presentation = getJobCardPresentation(
      createMinimalJob({
        distance_km: null,
        neighborhood: "Jardins",
      }),
    );

    expect(presentation.locationLine).toBe("Jardins");
  });

  it("formats published line with lowercase há in mid-sentence", () => {
    const presentation = getJobCardPresentation(
      createMinimalJob({
        granted_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      }),
    );

    expect(presentation.publishedLine).toMatch(/^Publicado há /);
    expect(presentation.publishedLine).not.toMatch(/^Publicado Há /);
  });

  it("exposes normalized description", () => {
    const presentation = getJobCardPresentation(
      createMinimalJob({
        description: "  Tomada com aterramento  ",
      }),
    );

    expect(presentation.description).toBe("Tomada com aterramento");
  });

  it("returns null description when empty", () => {
    const presentation = getJobCardPresentation(
      createMinimalJob({
        description: "   ",
      }),
    );

    expect(presentation.description).toBeNull();
  });

  it("flags fallback source for badge display", () => {
    const presentation = getJobCardPresentation(
      createMinimalJob({
        source: "fallback",
      }),
    );

    expect(presentation.showFallbackBadge).toBe(true);
  });
});
