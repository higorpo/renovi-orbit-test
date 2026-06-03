import { describe, it, expect } from "vitest";
import { computeDesktopNavVisibleCount } from "../computeDesktopNavVisibleCount";

describe("computeDesktopNavVisibleCount", () => {
  it("returns all items when everything fits without more button", () => {
    expect(
      computeDesktopNavVisibleCount({
        containerWidth: 500,
        itemWidths: [80, 100, 90, 70],
        moreButtonWidth: 40,
      })
    ).toBe(4);
  });

  it("returns 0 for empty items", () => {
    expect(
      computeDesktopNavVisibleCount({
        containerWidth: 200,
        itemWidths: [],
        moreButtonWidth: 40,
      })
    ).toBe(0);
  });

  it("truncates and reserves space for more button", () => {
    expect(
      computeDesktopNavVisibleCount({
        containerWidth: 250,
        itemWidths: [80, 100, 90, 70],
        moreButtonWidth: 40,
        gapPx: 6,
      })
    ).toBe(2);
  });

  it("returns at least one visible item when container is narrow", () => {
    expect(
      computeDesktopNavVisibleCount({
        containerWidth: 50,
        itemWidths: [80, 100],
        moreButtonWidth: 40,
      })
    ).toBe(1);
  });
});
