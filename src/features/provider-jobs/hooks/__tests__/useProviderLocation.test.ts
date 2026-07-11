// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderLocation } from "../useProviderLocation";

const nativeMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  captureOperationalLocationFix: vi.fn(),
  getOperationalLocationPermissionStatus: vi.fn(),
  getLatestProviderLocationSample: vi.fn(() => null),
  subscribeProviderLocationSamples: vi.fn(() => () => {}),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => nativeMocks.isNativePlatform(),
  },
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => ({ user: { id: "provider-1" } }),
}));

vi.mock("@/features/device-beacon", () => ({
  captureOperationalLocationFix: (...args: unknown[]) =>
    nativeMocks.captureOperationalLocationFix(...args),
  getOperationalLocationPermissionStatus: (...args: unknown[]) =>
    nativeMocks.getOperationalLocationPermissionStatus(...args),
  getLatestProviderLocationSample: (...args: unknown[]) =>
    nativeMocks.getLatestProviderLocationSample(...args),
  subscribeProviderLocationSamples: (...args: unknown[]) =>
    nativeMocks.subscribeProviderLocationSamples(...args),
}));

describe("useProviderLocation", () => {
  const geo = {
    getCurrentPosition: vi.fn(),
  };

  beforeEach(() => {
    nativeMocks.isNativePlatform.mockReturnValue(false);
    nativeMocks.captureOperationalLocationFix.mockReset();
    nativeMocks.getOperationalLocationPermissionStatus.mockReset();
    nativeMocks.getLatestProviderLocationSample.mockReset();
    nativeMocks.getLatestProviderLocationSample.mockReturnValue(null);
    nativeMocks.subscribeProviderLocationSamples.mockReset();
    nativeMocks.subscribeProviderLocationSamples.mockReturnValue(() => {});
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

  it("does not fabricate coordinates when geolocation API is null", async () => {
    vi.spyOn(globalThis.navigator, "geolocation", "get").mockReturnValue(
      null as unknown as Geolocation,
    );

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.location).toBeNull();
    expect(result.current.hasFeedLocation).toBe(false);
    expect(result.current.isUsingDefault).toBe(true);
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
    expect(result.current.hasFeedLocation).toBe(true);
    expect(result.current.isUsingDefault).toBe(false);
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

  it("clears feed coordinates on insecure non-local context", async () => {
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
    expect(result.current.location).toBeNull();
    expect(result.current.hasFeedLocation).toBe(false);
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

  it("does not fabricate coordinates when high-accuracy retry still fails", async () => {
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
    expect(result.current.location).toBeNull();
    expect(result.current.isUsingDefault).toBe(true);
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

  it("uses native geolocation on Capacitor and ignores WebView insecure context", async () => {
    nativeMocks.isNativePlatform.mockReturnValue(true);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      hostname: "192.168.0.248",
    } as Location);

    nativeMocks.getOperationalLocationPermissionStatus.mockResolvedValue("granted");
    nativeMocks.getLatestProviderLocationSample.mockReturnValue({
      latitude: -27.1,
      longitude: -48.2,
      accuracyMeters: 15,
      recordedAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() =>
      expect(result.current.location).toEqual({
        latitude: -27.1,
        longitude: -48.2,
      }),
    );
    expect(result.current.insecureContext).toBe(false);
    expect(result.current.hasFeedLocation).toBe(true);
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    expect(nativeMocks.subscribeProviderLocationSamples).toHaveBeenCalled();
  });

  it("captures native fix when no cached beacon sample exists", async () => {
    nativeMocks.isNativePlatform.mockReturnValue(true);
    nativeMocks.getOperationalLocationPermissionStatus.mockResolvedValue("granted");
    nativeMocks.getLatestProviderLocationSample.mockReturnValue(null);
    nativeMocks.captureOperationalLocationFix.mockResolvedValue({
      granted: true,
      status: "granted",
      latitude: -27.9,
      longitude: -48.4,
      accuracyMeters: 20,
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() =>
      expect(result.current.location).toEqual({
        latitude: -27.9,
        longitude: -48.4,
      }),
    );
    expect(nativeMocks.captureOperationalLocationFix).toHaveBeenCalled();
  });

  it("clears feed when native permission status is denied", async () => {
    nativeMocks.isNativePlatform.mockReturnValue(true);
    nativeMocks.getOperationalLocationPermissionStatus.mockResolvedValue("denied");

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.permissionDenied).toBe(true));
    expect(result.current.location).toBeNull();
    expect(result.current.error).toContain("negada");
    expect(nativeMocks.captureOperationalLocationFix).not.toHaveBeenCalled();
  });

  it("clears feed when native geolocation is unsupported", async () => {
    nativeMocks.isNativePlatform.mockReturnValue(true);
    nativeMocks.getOperationalLocationPermissionStatus.mockResolvedValue("unsupported");

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.error).toContain("não disponível");
    expect(result.current.location).toBeNull();
  });

  it("clears feed when native fix reports denied status", async () => {
    nativeMocks.isNativePlatform.mockReturnValue(true);
    nativeMocks.getOperationalLocationPermissionStatus.mockResolvedValue("granted");
    nativeMocks.getLatestProviderLocationSample.mockReturnValue(null);
    nativeMocks.captureOperationalLocationFix.mockResolvedValue({
      granted: false,
      status: "denied",
      latitude: null,
      longitude: null,
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.permissionDenied).toBe(true));
    expect(result.current.error).toContain("negada");
  });

  it("clears feed when native fix cannot provide coordinates", async () => {
    nativeMocks.isNativePlatform.mockReturnValue(true);
    nativeMocks.getOperationalLocationPermissionStatus.mockResolvedValue("granted");
    nativeMocks.getLatestProviderLocationSample.mockReturnValue(null);
    nativeMocks.captureOperationalLocationFix.mockResolvedValue({
      granted: false,
      status: "unavailable",
      latitude: null,
      longitude: null,
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.error).toContain("Não foi possível obter");
  });

  it("applies native beacon samples for the signed-in provider only", async () => {
    nativeMocks.isNativePlatform.mockReturnValue(true);
    nativeMocks.getOperationalLocationPermissionStatus.mockResolvedValue("prompt");
    nativeMocks.getLatestProviderLocationSample.mockReturnValue(null);
    nativeMocks.captureOperationalLocationFix.mockResolvedValue({
      granted: false,
      status: "prompt",
      latitude: null,
      longitude: null,
    });

    let sampleListener:
      | ((id: string, sample: { latitude: number; longitude: number }) => void)
      | null = null;
    nativeMocks.subscribeProviderLocationSamples.mockImplementation((cb) => {
      sampleListener = cb;
      return () => {};
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.location).toBeNull();

    await act(async () => {
      sampleListener?.("other-provider", { latitude: 1, longitude: 2 });
    });
    expect(result.current.location).toBeNull();

    await act(async () => {
      sampleListener?.("provider-1", { latitude: -22.1, longitude: -43.2 });
    });

    await waitFor(() =>
      expect(result.current.location).toEqual({
        latitude: -22.1,
        longitude: -43.2,
      }),
    );
  });

  it("applies cached native sample when location is still empty after mount", async () => {
    nativeMocks.isNativePlatform.mockReturnValue(true);
    nativeMocks.getOperationalLocationPermissionStatus.mockResolvedValue("granted");
    nativeMocks.getLatestProviderLocationSample
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        latitude: -26.5,
        longitude: -49.1,
        accuracyMeters: 10,
        recordedAt: new Date().toISOString(),
      });
    nativeMocks.captureOperationalLocationFix.mockResolvedValue({
      granted: false,
      status: "unavailable",
      latitude: null,
      longitude: null,
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() =>
      expect(result.current.location).toEqual({
        latitude: -26.5,
        longitude: -49.1,
      }),
    );
  });

  it("does not re-request web location when permission change is not granted", async () => {
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

    geo.getCurrentPosition.mockImplementation((_success, fail) => {
      queueMicrotask(() => fail?.({ code: 1 } as GeolocationPositionError));
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.permissionDenied).toBe(true));
    const callsAfterDenied = geo.getCurrentPosition.mock.calls.length;

    status.state = "denied";
    await act(async () => {
      listeners.change?.();
    });

    expect(geo.getCurrentPosition.mock.calls.length).toBe(callsAfterDenied);
  });

  it("removes geolocation permission listener on unmount", async () => {
    const status = {
      state: "prompt",
      addEventListener: vi.fn(),
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
          coords: { latitude: 1, longitude: 1 },
        } as GeolocationPosition),
      );
    });

    const { unmount } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(status.addEventListener).toHaveBeenCalled());
    unmount();
    expect(status.removeEventListener).toHaveBeenCalled();
  });
});

describe("useProviderLocation additional branches", () => {
  const geo = {
    getCurrentPosition: vi.fn(),
  };

  beforeEach(() => {
    nativeMocks.isNativePlatform.mockReturnValue(false);
    nativeMocks.captureOperationalLocationFix.mockReset();
    nativeMocks.getOperationalLocationPermissionStatus.mockReset();
    nativeMocks.getLatestProviderLocationSample.mockReset();
    nativeMocks.getLatestProviderLocationSample.mockReturnValue(null);
    nativeMocks.subscribeProviderLocationSamples.mockReset();
    nativeMocks.subscribeProviderLocationSamples.mockReturnValue(() => {});
    vi.spyOn(globalThis.navigator, "geolocation", "get").mockReturnValue(
      geo as unknown as Geolocation,
    );
    geo.getCurrentPosition.mockReset();
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not look up a cached native sample when the user is null", async () => {
    const authModule = await import("@/features/auth");
    vi.spyOn(authModule, "useAuth").mockReturnValue({ user: null } as ReturnType<
      typeof authModule.useAuth
    >);
    nativeMocks.isNativePlatform.mockReturnValue(true);
    nativeMocks.getOperationalLocationPermissionStatus.mockResolvedValue("prompt");
    nativeMocks.captureOperationalLocationFix.mockResolvedValue({
      granted: false,
      status: "prompt",
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(nativeMocks.getLatestProviderLocationSample).not.toHaveBeenCalled();
    expect(nativeMocks.subscribeProviderLocationSamples).not.toHaveBeenCalled();
  });

  it("shows a generic error when a granted native fix has no coordinates", async () => {
    nativeMocks.isNativePlatform.mockReturnValue(true);
    nativeMocks.getOperationalLocationPermissionStatus.mockResolvedValue("granted");
    nativeMocks.captureOperationalLocationFix.mockResolvedValue({
      granted: true,
      status: "granted",
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.location).toBeNull();
    expect(result.current.error).toContain("Não foi possível obter");
  });

  it("skips the cache effect after the initial native request sets location", async () => {
    nativeMocks.isNativePlatform.mockReturnValue(true);
    nativeMocks.getOperationalLocationPermissionStatus.mockResolvedValue("granted");
    nativeMocks.getLatestProviderLocationSample.mockReturnValue({
      latitude: 10,
      longitude: 20,
      accuracyMeters: 5,
      recordedAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() =>
      expect(result.current.location).toEqual({ latitude: 10, longitude: 20 }),
    );
    expect(nativeMocks.getLatestProviderLocationSample).toHaveBeenCalledTimes(2);
  });

  it("does not subscribe to native samples on web", async () => {
    geo.getCurrentPosition.mockImplementation((success: PositionCallback) => {
      queueMicrotask(() =>
        success({
          coords: { latitude: 1, longitude: 2 },
        } as GeolocationPosition),
      );
    });

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.location).not.toBeNull());
    expect(nativeMocks.subscribeProviderLocationSamples).not.toHaveBeenCalled();
  });

  it("does not register a web permission listener on native", async () => {
    const query = vi.fn();
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: geo as unknown as Geolocation,
      permissions: { query },
    });
    nativeMocks.isNativePlatform.mockReturnValue(true);
    nativeMocks.getOperationalLocationPermissionStatus.mockResolvedValue("denied");

    const { result } = renderHook(() => useProviderLocation());

    await waitFor(() => expect(result.current.permissionDenied).toBe(true));
    expect(query).not.toHaveBeenCalled();
  });
});
