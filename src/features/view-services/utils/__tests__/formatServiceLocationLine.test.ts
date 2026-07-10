import { describe, expect, it } from "vitest";
import { formatServiceLocationLine } from "../formatServiceLocationLine";

describe("formatServiceLocationLine", () => {
  it("returns empty string when address is null", () => {
    expect(formatServiceLocationLine(null)).toBe("");
  });

  it("returns empty string when locality and state are both empty", () => {
    expect(
      formatServiceLocationLine({
        neighborhood: "  ",
        cityName: "",
        stateAbbreviation: "  ",
      }),
    ).toBe("");
  });

  it("formats locality with state in parentheses", () => {
    expect(
      formatServiceLocationLine({
        neighborhood: "Centro",
        cityName: "Florianópolis",
        stateAbbreviation: "SC",
      }),
    ).toBe("Centro, Florianópolis (SC)");
  });

  it("returns only locality when state is missing", () => {
    expect(
      formatServiceLocationLine({
        neighborhood: "Centro",
        cityName: "Florianópolis",
      }),
    ).toBe("Centro, Florianópolis");
  });

  it("returns only state when locality is missing", () => {
    expect(
      formatServiceLocationLine({
        neighborhood: "",
        cityName: "",
        stateAbbreviation: "RJ",
      }),
    ).toBe("RJ");
  });
});
