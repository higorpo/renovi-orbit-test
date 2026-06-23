import { describe, expect, it } from "vitest";
import { buildGoogleMapsUrl } from "../openGoogleMaps";

describe("buildGoogleMapsUrl", () => {
  it("builds a Google Maps search URL with latitude and longitude", () => {
    expect(
      buildGoogleMapsUrl({ latitude: -27.5954, longitude: -48.548 }),
    ).toBe("https://www.google.com/maps/search/?api=1&query=-27.5954,-48.548");
  });
});
