import { describe, expect, it } from "vitest";
import { formatDistance } from "@/lib/formatDistance";

describe("formatDistance", () => {
  it.each([
    [0, "< 100 m"],
    [0.099, "< 100 m"],
    [0.1, "100 m"],
    [0.749, "749 m"],
    [1, "1,0 km"],
    [1.45, "1,4 km"],
    [9.99, "10,0 km"],
    [10, "10 km"],
    [12.6, "13 km"],
  ])("formats %s km as %s", (distance, expected) => {
    expect(formatDistance(distance)).toBe(expected);
  });
});
