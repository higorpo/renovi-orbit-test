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
});
