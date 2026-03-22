import { describe, expect, it } from "vitest";
import {
  DEFAULT_RADIUS_KM,
  DEFAULT_SORT_MODE,
  RADIUS_OPTIONS,
  SORT_MODES,
} from "../sortModes";

describe("sortModes", () => {
  it("exposes three sort modes with ids and labels", () => {
    expect(SORT_MODES).toHaveLength(3);
    expect(SORT_MODES.map((m) => m.id)).toEqual([
      "nearest",
      "newest",
      "least_competitive",
    ]);
    expect(SORT_MODES[0].label).toBe("Mais próximos");
    expect(SORT_MODES[0].icon).toBeDefined();
  });

  it("uses expected defaults", () => {
    expect(DEFAULT_SORT_MODE).toBe("nearest");
    expect(DEFAULT_RADIUS_KM).toBe(10);
    expect(RADIUS_OPTIONS).toEqual([2, 5, 10, 20, 50]);
  });
});
