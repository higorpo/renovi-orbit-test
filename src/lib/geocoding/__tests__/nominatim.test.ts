import { describe, it, expect, vi, beforeEach } from "vitest";
import { NominatimGeocodingAdapter } from "../nominatim";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("NominatimGeocodingAdapter", () => {
  let adapter: NominatimGeocodingAdapter;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new NominatimGeocodingAdapter();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
  });

  describe("geocode", () => {
    it("returns null when address is empty or whitespace", async () => {
      expect(await adapter.geocode("")).toBeNull();
      expect(await adapter.geocode("   ")).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns coordinates when search returns valid result", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { lat: "-27.5954", lon: "-48.548", display_name: "Florianópolis, SC, Brasil" },
        ],
      });

      const result = await adapter.geocode("Florianópolis");

      expect(result).toEqual({
        latitude: -27.5954,
        longitude: -48.548,
        displayName: "Florianópolis, SC, Brasil",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("nominatim.openstreetmap.org/search"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "PrestwayOrbit/1.0 (contact@prestway.com)",
            "Accept": "application/json",
          }),
        })
      );
    });

    it("trims address before request", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: "0", lon: "0" }],
      });

      await adapter.geocode("  Rua das Flores  ");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/q=Rua\+das\+Flores/),
        expect.any(Object)
      );
    });

    it("returns null when response is not ok", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 429 });

      const result = await adapter.geocode("some address");

      expect(result).toBeNull();
    });

    it("returns null when response is empty array", async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });

      const result = await adapter.geocode("nowhere");

      expect(result).toBeNull();
    });

    it("returns null when response is not an array", async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const result = await adapter.geocode("test");

      expect(result).toBeNull();
    });

    it("returns null when first result has invalid lat/lon type", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: null, lon: "-48" }],
      });

      const result = await adapter.geocode("test");

      expect(result).toBeNull();
    });

    it("returns null when lat/lon parse to NaN", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: "invalid", lon: "invalid" }],
      });

      const result = await adapter.geocode("test");

      expect(result).toBeNull();
    });

    it("returns null when fetch throws", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      const result = await adapter.geocode("test");

      expect(result).toBeNull();
    });
  });

  describe("reverseGeocode", () => {
    it("returns null when latitude is out of range", async () => {
      expect(await adapter.reverseGeocode(-91, 0)).toBeNull();
      expect(await adapter.reverseGeocode(91, 0)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns null when longitude is out of range", async () => {
      expect(await adapter.reverseGeocode(0, -181)).toBeNull();
      expect(await adapter.reverseGeocode(0, 181)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns null when coordinates are not numbers", async () => {
      expect(await adapter.reverseGeocode(NaN, 0)).toBeNull();
      expect(await adapter.reverseGeocode(0, NaN)).toBeNull();
      // @ts-expect-error testing invalid input
      expect(await adapter.reverseGeocode("0", 0)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns address components when reverse returns valid result", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lat: "-27.5954",
          lon: "-48.548",
          display_name: "Rua XYZ, 100, Florianópolis, SC, Brasil",
          address: {
            road: "Rua XYZ",
            house_number: "100",
            suburb: "Centro",
            city: "Florianópolis",
            state: "Santa Catarina",
            postcode: "88015100",
            country: "Brasil",
            country_code: "br",
          },
        }),
      });

      const result = await adapter.reverseGeocode(-27.5954, -48.548);

      expect(result).toEqual({
        latitude: -27.5954,
        longitude: -48.548,
        street: "Rua XYZ",
        number: "100",
        neighborhood: "Centro",
        city: "Florianópolis",
        state: "Santa Catarina",
        postalCode: "88015100",
        country: "Brasil",
        displayName: "Rua XYZ, 100, Florianópolis, SC, Brasil",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("nominatim.openstreetmap.org/reverse"),
        expect.any(Object)
      );
    });

    it("uses town or village when city is missing", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lat: "-23.5",
          lon: "-46.6",
          address: { town: "São Paulo", state: "SP" },
        }),
      });

      const result = await adapter.reverseGeocode(-23.5, -46.6);

      expect(result?.city).toBe("São Paulo");
    });

    it("uses neighbourhood when suburb is missing", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lat: "-23.5",
          lon: "-46.6",
          address: { neighbourhood: "Bela Vista", city: "São Paulo" },
        }),
      });

      const result = await adapter.reverseGeocode(-23.5, -46.6);

      expect(result?.neighborhood).toBe("Bela Vista");
    });

    it("returns null when response is not ok", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });

      const result = await adapter.reverseGeocode(-27.59, -48.54);

      expect(result).toBeNull();
    });

    it("returns null when lat/lon in response are invalid", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lat: "x", lon: "y", address: {} }),
      });

      const result = await adapter.reverseGeocode(-27.59, -48.54);

      expect(result).toBeNull();
    });

    it("returns null when fetch throws", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      const result = await adapter.reverseGeocode(-27.59, -48.54);

      expect(result).toBeNull();
    });

    it("accepts valid boundary coordinates", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lat: "90", lon: "180", address: {} }),
      });

      const result = await adapter.reverseGeocode(90, 180);

      expect(result).not.toBeNull();
      expect(result?.latitude).toBe(90);
      expect(result?.longitude).toBe(180);
    });
  });
});
