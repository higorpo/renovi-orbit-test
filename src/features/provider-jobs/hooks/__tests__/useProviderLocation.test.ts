import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderLocation } from "../useProviderLocation";

describe("useProviderLocation", () => {
  const geo = {
    getCurrentPosition: vi.fn(),
  };

  beforeEach(() => {
    vi.spyOn(globalThis.navigator, "geolocation", "get").mockReturnValue(
      geo as unknown as Geolocation,
    );
    geo.getCurrentPosition.mockReset();
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      hostname: "localhost",
    } as Location);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses default location when geolocation API is null", async () => {
    vi.spyOn(globalThis.navigator, "geolocation", "get").mockReturnValue(
      null as unknown as Geolocation,
    );

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.location).toEqual({
      latitude: -27.5969,
      longitude: -48.5495,
    });
    expect(result.current.error).toContain("não disponível");
  });

  it("resolves coordinates on success", async () => {
    geo.getCurrentPosition.mockImplementation((success: PositionCallback) => {
      queueMicrotask(() =>
        success({
          coords: { latitude: -10, longitude: -20 },
        } as GeolocationPosition),
      );
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() =>
      expect(result.current.location).toEqual({
        latitude: -10,
        longitude: -20,
      }),
    );
    expect(result.current.error).toBeNull();
  });

  it("sets permission denied when error code is 1", async () => {
    geo.getCurrentPosition.mockImplementation((_ok, fail) => {
      queueMicrotask(() => fail?.({ code: 1 } as GeolocationPositionError));
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.permissionDenied).toBe(true));
    expect(result.current.error).toContain("negada");
  });

  it("retry triggers another getCurrentPosition", async () => {
    let calls = 0;
    geo.getCurrentPosition.mockImplementation((success, fail) => {
      calls += 1;
      queueMicrotask(() => {
        if (calls === 1) {
          fail?.({ code: 1 } as GeolocationPositionError);
        } else {
          success({
            coords: { latitude: 1, longitude: 2 },
          } as GeolocationPosition);
        }
      });
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.permissionDenied).toBe(true));

    act(() => {
      result.current.retry();
    });

    await waitFor(() =>
      expect(result.current.location).toEqual({ latitude: 1, longitude: 2 }),
    );
  });

  it("retries with high accuracy after timeout or unavailable error", async () => {
    let calls = 0;
    geo.getCurrentPosition.mockImplementation((success, fail) => {
      calls += 1;
      queueMicrotask(() => {
        if (calls === 1) {
          fail?.({ code: 2 } as GeolocationPositionError);
        } else {
          success({
            coords: { latitude: 3, longitude: 4 },
          } as GeolocationPosition);
        }
      });
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() =>
      expect(result.current.location).toEqual({ latitude: 3, longitude: 4 }),
    );
  });

  it("uses default when context is insecure and host is not local", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      hostname: "example.com",
    } as Location);

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.insecureContext).toBe(true));
    expect(result.current.error).toContain("HTTPS");
    expect(result.current.location).toEqual({
      latitude: -27.5969,
      longitude: -48.5495,
    });
  });
});
