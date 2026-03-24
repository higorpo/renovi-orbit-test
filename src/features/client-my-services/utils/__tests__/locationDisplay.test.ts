import { describe, it, expect } from "vitest";
import { formatLocationDisplay } from "../locationDisplay";
import type { AddressSummary } from "../../types/client-my-services.types";

describe("formatLocationDisplay", () => {
  it("returns empty string for null", () => {
    expect(formatLocationDisplay(null)).toBe("");
  });

  it("returns neighborhood and city joined by comma when no street", () => {
    const addr: AddressSummary = {
      neighborhood: "Trindade",
      cityName: "Florianópolis",
    };
    expect(formatLocationDisplay(addr)).toBe("Trindade, Florianópolis");
  });

  it("formats with state in parentheses", () => {
    const addr: AddressSummary = {
      neighborhood: "Trindade",
      cityName: "Florianópolis",
      stateAbbreviation: "SC",
    };
    expect(formatLocationDisplay(addr)).toBe("Trindade, Florianópolis (SC)");
  });

  it("formats as street - locality (UF)", () => {
    const addr: AddressSummary = {
      streetSummary: "Rua Delminda Silveira, 729",
      neighborhood: "Agronômica",
      cityName: "Florianópolis",
      stateAbbreviation: "SC",
    };
    expect(formatLocationDisplay(addr)).toBe(
      "Rua Delminda Silveira, 729 - Agronômica, Florianópolis (SC)"
    );
  });
});
