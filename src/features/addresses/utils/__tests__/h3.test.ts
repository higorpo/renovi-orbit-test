import { describe, it, expect } from "vitest";
import { latLngToH3Index, H3_RESOLUTION_ADDRESS } from "../h3";

describe("latLngToH3Index", () => {
  it("returns H3 index string for valid WGS84 coordinates", () => {
    const result = latLngToH3Index(-23.5505, -46.6333);
    expect(result).toBeTypeOf("string");
    expect(result).toMatch(/^[0-9a-f]+$/);
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns same index for same point at same resolution", () => {
    const a = latLngToH3Index(-23.5505, -46.6333);
    const b = latLngToH3Index(-23.5505, -46.6333);
    expect(a).toBe(b);
  });

  it("returns different index for different resolution when provided", () => {
    const r9 = latLngToH3Index(-23.5505, -46.6333, 9);
    const r8 = latLngToH3Index(-23.5505, -46.6333, 8);
    expect(r9).not.toBe(r8);
  });

  it("returns null when latitude is out of range", () => {
    expect(latLngToH3Index(91, 0)).toBeNull();
    expect(latLngToH3Index(-91, 0)).toBeNull();
  });

  it("returns null when longitude is out of range", () => {
    expect(latLngToH3Index(0, 181)).toBeNull();
    expect(latLngToH3Index(0, -181)).toBeNull();
  });

  it("returns null when coordinates are NaN", () => {
    expect(latLngToH3Index(NaN, 0)).toBeNull();
    expect(latLngToH3Index(0, NaN)).toBeNull();
  });

  it("uses H3_RESOLUTION_ADDRESS (9) by default", () => {
    const withDefault = latLngToH3Index(-23.55, -46.63);
    const withExplicit = latLngToH3Index(-23.55, -46.63, H3_RESOLUTION_ADDRESS);
    expect(withDefault).toBe(withExplicit);
  });
});
