// @vitest-environment happy-dom
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

  it("uses generic copy when first geolocation error is not timeout, unavailable, or denial", async () => {
    geo.getCurrentPosition.mockImplementation((_ok, fail) => {
      queueMicrotask(() => fail?.({ code: 99 } as GeolocationPositionError));
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.error).toContain("Não foi possível obter");
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

  it("retries with high accuracy after timeout error (code 3)", async () => {
    let calls = 0;
    geo.getCurrentPosition.mockImplementation((success, fail) => {
      calls += 1;
      queueMicrotask(() => {
        if (calls === 1) {
          fail?.({ code: 3 } as GeolocationPositionError);
        } else {
          success({
            coords: { latitude: 5, longitude: 6 },
          } as GeolocationPosition);
        }
      });
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() =>
      expect(result.current.location).toEqual({ latitude: 5, longitude: 6 }),
    );
  });

  it("falls back to default when high-accuracy retry still fails without denial", async () => {
    let calls = 0;
    geo.getCurrentPosition.mockImplementation((_success, fail) => {
      calls += 1;
      queueMicrotask(() => {
        fail?.({ code: 2 } as GeolocationPositionError);
      });
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.error).toContain("Não foi possível obter");
    expect(result.current.location).toEqual({
      latitude: -27.5969,
      longitude: -48.5495,
    });
  });

  it("allows geolocation on insecure context when hostname is IPv6 localhost", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      hostname: "[::1]",
    } as Location);

    geo.getCurrentPosition.mockImplementation((success) => {
      queueMicrotask(() =>
        success({
          coords: { latitude: 7, longitude: 8 },
        } as GeolocationPosition),
      );
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() =>
      expect(result.current.location).toEqual({ latitude: 7, longitude: 8 }),
    );
    expect(result.current.insecureContext).toBe(false);
  });

  it("re-requests location when permission changes to granted", async () => {
    const listeners: Record<string, () => void> = {};
    const status = {
      state: "prompt",
      addEventListener: vi.fn((event: string, cb: () => void) => {
        listeners[event] = cb;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: geo as unknown as Geolocation,
      permissions: {
        query: vi.fn().mockResolvedValue(status),
      },
    });

    geo.getCurrentPosition.mockImplementation((success) => {
      queueMicrotask(() =>
        success({
          coords: { latitude: 9, longitude: 10 },
        } as GeolocationPosition),
      );
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() =>
      expect(result.current.location).toEqual({ latitude: 9, longitude: 10 }),
    );

    geo.getCurrentPosition.mockClear();
    geo.getCurrentPosition.mockImplementation((success) => {
      queueMicrotask(() =>
        success({
          coords: { latitude: 11, longitude: 12 },
        } as GeolocationPosition),
      );
    });

    status.state = "granted";
    await act(async () => {
      listeners.change?.();
    });

    await waitFor(() =>
      expect(result.current.location).toEqual({ latitude: 11, longitude: 12 }),
    );
    expect(geo.getCurrentPosition).toHaveBeenCalled();
  });

  it("does not register permission listener if hook unmounts before query resolves", async () => {
    let resolveQuery: (v: {
      state: string;
      addEventListener: () => void;
      removeEventListener: () => void;
    }) => void = () => {};
    const status = {
      state: "prompt",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: geo as unknown as Geolocation,
      permissions: {
        query: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveQuery = resolve as typeof resolveQuery;
            }),
        ),
      },
    });

    geo.getCurrentPosition.mockImplementation((success) => {
      queueMicrotask(() =>
        success({
          coords: { latitude: 0, longitude: 0 },
        } as GeolocationPosition),
      );
    });

    const { unmount } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(geo.getCurrentPosition).toHaveBeenCalled());
    unmount();

    await act(async () => {
      resolveQuery(status);
    });

    expect(status.addEventListener).not.toHaveBeenCalled();
  });

  it("allows geolocation on insecure context when hostname is 127.0.0.1", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      hostname: "127.0.0.1",
    } as Location);

    geo.getCurrentPosition.mockImplementation((success) => {
      queueMicrotask(() =>
        success({
          coords: { latitude: 13, longitude: 14 },
        } as GeolocationPosition),
      );
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() =>
      expect(result.current.location).toEqual({ latitude: 13, longitude: 14 }),
    );
    expect(result.current.insecureContext).toBe(false);
  });

  it("sets permission denied when high-accuracy retry returns code 1", async () => {
    let calls = 0;
    geo.getCurrentPosition.mockImplementation((_success, fail) => {
      calls += 1;
      queueMicrotask(() => {
        if (calls === 1) {
          fail?.({ code: 2 } as GeolocationPositionError);
        } else {
          fail?.({ code: 1 } as GeolocationPositionError);
        }
      });
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.permissionDenied).toBe(true));
    expect(result.current.error).toContain("negada");
  });

  it("ignores permissions API when query rejects", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: geo as unknown as Geolocation,
      permissions: {
        query: vi.fn().mockRejectedValue(new Error("unsupported")),
      },
    });

    geo.getCurrentPosition.mockImplementation((success) => {
      queueMicrotask(() =>
        success({
          coords: { latitude: 20, longitude: 21 },
        } as GeolocationPosition),
      );
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() =>
      expect(result.current.location).toEqual({ latitude: 20, longitude: 21 }),
    );
  });
});
