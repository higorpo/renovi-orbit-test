import { describe, expect, it } from "vitest";
import { formatLocationDisplay } from "../locationDisplay";

describe("formatLocationDisplay", () => {
  it("shows masked locality when street is absent", () => {
    expect(
      formatLocationDisplay({
        neighborhood: "Centro",
        cityName: "Florianópolis",
        stateAbbreviation: "SC",
      }),
    ).toBe("Centro, Florianópolis (SC)");
  });

  it("includes street when full address is available", () => {
    expect(
      formatLocationDisplay({
        neighborhood: "Centro",
        cityName: "Florianópolis",
        stateAbbreviation: "SC",
        streetSummary: "Rua Felipe Schmidt, 515",
      }),
    ).toBe("Rua Felipe Schmidt, 515 - Centro, Florianópolis (SC)");
  });

  it("returns empty string when address is null", () => {
    expect(formatLocationDisplay(null)).toBe("");
  });

  it("omits state parentheses when abbreviation is missing", () => {
    expect(
      formatLocationDisplay({
        neighborhood: "Centro",
        cityName: "Florianópolis",
        streetSummary: "Rua A, 1",
      }),
    ).toBe("Rua A, 1 - Centro, Florianópolis");
  });

  it("returns only street when locality is empty", () => {
    expect(
      formatLocationDisplay({
        neighborhood: "",
        cityName: "",
        streetSummary: "Rua Só",
        stateAbbreviation: "PR",
      }),
    ).toBe("Rua Só (PR)");
  });
});
