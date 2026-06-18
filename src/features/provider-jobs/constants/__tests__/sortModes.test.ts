import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT_MODE,
  DEFAULT_SORT_MODE_WITH_GPS,
  DEFAULT_SORT_MODE_WITHOUT_GPS,
  SORT_MODES,
  getDefaultSortMode,
  getVisibleSortModes,
  isSortModeAllowed,
} from "../sortModes";

describe("sortModes", () => {
  it("exposes three sort modes with ids and labels", () => {
    expect(SORT_MODES).toHaveLength(3);
    expect(SORT_MODES.map((m) => m.id)).toEqual([
      "newest",
      "nearest",
      "least_competitive",
    ]);
    expect(SORT_MODES[1].label).toBe("Mais próximos");
    expect(SORT_MODES[0].icon).toBeDefined();
  });

  it("defaults to newest without feed GPS and nearest with GPS", () => {
    expect(DEFAULT_SORT_MODE).toBe("newest");
    expect(DEFAULT_SORT_MODE_WITHOUT_GPS).toBe("newest");
    expect(DEFAULT_SORT_MODE_WITH_GPS).toBe("nearest");
    expect(getDefaultSortMode(false)).toBe("newest");
    expect(getDefaultSortMode(true)).toBe("nearest");
  });

  it("hides nearest tab when feed GPS is unavailable", () => {
    expect(getVisibleSortModes(false).map((m) => m.id)).toEqual([
      "newest",
      "least_competitive",
    ]);
    expect(getVisibleSortModes(true).map((m) => m.id)).toEqual([
      "newest",
      "nearest",
      "least_competitive",
    ]);
  });

  it("blocks nearest sort mode without feed GPS", () => {
    expect(isSortModeAllowed("nearest", false)).toBe(false);
    expect(isSortModeAllowed("nearest", true)).toBe(true);
    expect(isSortModeAllowed("newest", false)).toBe(true);
    expect(isSortModeAllowed("least_competitive", false)).toBe(true);
  });
});
