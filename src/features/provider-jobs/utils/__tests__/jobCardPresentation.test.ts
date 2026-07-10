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

  it("formats published line as Publicado agora for very recent grants", () => {
    const presentation = getJobCardPresentation(
      createMinimalJob({
        granted_at: new Date().toISOString(),
      }),
    );

    expect(presentation.publishedLine).toBe("Publicado agora");
  });

  it("formats published line with absolute date when relative is not Há-prefixed", () => {
    const presentation = getJobCardPresentation(
      createMinimalJob({
        granted_at: new Date(Date.now() - 60 * 86_400_000).toISOString(),
      }),
    );

    expect(presentation.publishedLine).toMatch(/^Publicado em /);
  });

  it("shows urgency for high and medium, hides for low", () => {
    expect(
      getJobCardPresentation(createMinimalJob({ urgency: "high" })).showUrgency,
    ).toBe(true);
    expect(
      getJobCardPresentation(createMinimalJob({ urgency: "medium" })).showUrgency,
    ).toBe(true);
    expect(
      getJobCardPresentation(createMinimalJob({ urgency: "low" })).showUrgency,
    ).toBe(false);
  });
});
