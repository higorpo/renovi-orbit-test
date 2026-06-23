import { describe, expect, it } from "vitest";
import { getServiceCoordinates } from "../serviceLocation";

describe("getServiceCoordinates", () => {
  it("returns coordinates when latitude and longitude are finite", () => {
    expect(
      getServiceCoordinates({
        neighborhood: "Centro",
        cityName: "Florianópolis",
        latitude: -27.5954,
        longitude: -48.548,
      }),
    ).toEqual({ latitude: -27.5954, longitude: -48.548 });
  });

  it("returns null when coordinates are missing or invalid", () => {
    expect(getServiceCoordinates(null)).toBeNull();
    expect(
      getServiceCoordinates({
        neighborhood: "Centro",
        cityName: "Florianópolis",
      }),
    ).toBeNull();
    expect(
      getServiceCoordinates({
        neighborhood: "Centro",
        cityName: "Florianópolis",
        latitude: Number.NaN,
        longitude: -48.548,
      }),
    ).toBeNull();
  });
});
