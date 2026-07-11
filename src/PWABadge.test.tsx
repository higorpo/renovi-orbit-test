import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const registerState = vi.hoisted(() => ({
  offlineReady: false,
  needRefresh: false,
  setOfflineReady: vi.fn((value: boolean) => {
    registerState.offlineReady = value;
  }),
  setNeedRefresh: vi.fn((value: boolean) => {
    registerState.needRefresh = value;
  }),
  updateServiceWorker: vi.fn(),
  onRegisteredSW: null as
    | ((swUrl: string, registration: ServiceWorkerRegistration | undefined) => void)
    | null,
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (options?: {
    onRegisteredSW?: (
      swUrl: string,
      registration: ServiceWorkerRegistration | undefined,
    ) => void;
  }) => {
    registerState.onRegisteredSW = options?.onRegisteredSW ?? null;
    return {
      offlineReady: [
        registerState.offlineReady,
        registerState.setOfflineReady,
      ] as const,
      needRefresh: [registerState.needRefresh, registerState.setNeedRefresh] as const,
      updateServiceWorker: registerState.updateServiceWorker,
    };
  },
}));

import PWABadge from "./PWABadge";

describe("PWABadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerState.offlineReady = false;
    registerState.needRefresh = false;
    registerState.onRegisteredSW = null;
  });

  it("stays hidden when neither offline nor refresh banners are active", () => {
    render(<PWABadge />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("shows offline-ready copy and closes on acknowledge", () => {
    registerState.offlineReady = true;
    render(<PWABadge />);

    expect(screen.getByRole("heading", { name: /Pronto para usar offline/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Entendi, obrigado/i }));
    expect(registerState.setOfflineReady).toHaveBeenCalledWith(false);
    expect(registerState.setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it("shows refresh banner and updates the service worker", () => {
    registerState.needRefresh = true;
    render(<PWABadge />);

    expect(screen.getByRole("heading", { name: /Nova versão disponível/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Atualizar agora/i }));
    expect(registerState.updateServiceWorker).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: /Agora não/i }));
    expect(registerState.setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it("closes via the dismiss icon", () => {
    registerState.needRefresh = true;
    render(<PWABadge />);

    fireEvent.click(screen.getByRole("button", { name: /Fechar aviso/i }));
    expect(registerState.setOfflineReady).toHaveBeenCalledWith(false);
    expect(registerState.setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it("registers periodic sync when an activated worker is reported", () => {
    vi.useFakeTimers();
    const update = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });

    render(<PWABadge />);
    registerState.onRegisteredSW?.("/sw.js", {
      active: { state: "activated" },
      update,
    } as unknown as ServiceWorkerRegistration);

    vi.advanceTimersByTime(60 * 60 * 1000);
    return Promise.resolve().then(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/sw.js",
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(update).toHaveBeenCalled();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });
  });

  it("waits for installing worker activation before registering sync", () => {
    const listeners: Array<(event: Event) => void> = [];
    const installing = {
      addEventListener: vi.fn((_type: string, listener: (event: Event) => void) => {
        listeners.push(listener);
      }),
      state: "installing",
    };

    render(<PWABadge />);
    registerState.onRegisteredSW?.("/sw.js", {
      active: undefined,
      installing,
      update: vi.fn(),
    } as unknown as ServiceWorkerRegistration);

    expect(installing.addEventListener).toHaveBeenCalledWith(
      "statechange",
      expect.any(Function),
    );

    installing.state = "activated";
    listeners[0]?.({ target: installing } as unknown as Event);
  });

  it("skips periodic sync registration when registration is missing", () => {
    render(<PWABadge />);
    expect(() => registerState.onRegisteredSW?.("/sw.js", undefined)).not.toThrow();
  });

  it("skips the periodic update fetch while offline", async () => {
    vi.useFakeTimers();
    const update = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    render(<PWABadge />);
    registerState.onRegisteredSW?.("/sw.js", {
      active: { state: "activated" },
      update,
    } as unknown as ServiceWorkerRegistration);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not call update when the periodic fetch is non-200", async () => {
    vi.useFakeTimers();
    const update = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({ status: 503 });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });

    render(<PWABadge />);
    registerState.onRegisteredSW?.("/sw.js", {
      active: { state: "activated" },
      update,
    } as unknown as ServiceWorkerRegistration);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });


  it("prefers offline-ready copy when both offlineReady and needRefresh are true", () => {
    registerState.offlineReady = true;
    registerState.needRefresh = true;
    render(<PWABadge />);

    expect(screen.getByRole("heading", { name: /Pronto para usar offline/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Atualizar agora/i })).toBeInTheDocument();
  });

  it("skips periodic sync when service worker active state is not activated", () => {
    vi.useFakeTimers();
    const update = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<PWABadge />);
    registerState.onRegisteredSW?.("/sw.js", {
      active: { state: "redundant" },
      installing: undefined,
      update,
    } as unknown as ServiceWorkerRegistration);

    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ignores installing worker state changes before activation", () => {
    vi.useFakeTimers();
    const listeners: Array<(event: Event) => void> = [];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const installing = {
      addEventListener: vi.fn((_type: string, listener: (event: Event) => void) => {
        listeners.push(listener);
      }),
      state: "installing",
    };

    render(<PWABadge />);
    registerState.onRegisteredSW?.("/sw.js", {
      installing,
      update: vi.fn(),
    } as unknown as ServiceWorkerRegistration);

    installing.state = "redundant";
    listeners[0]?.({ target: installing } as unknown as Event);
    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(fetchMock).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

});
