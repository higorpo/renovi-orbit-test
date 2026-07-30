import { describe, expect, it, vi, beforeEach } from "vitest";
import { injectClearSaleSdk } from "../injectClearSaleSdk";

describe("injectClearSaleSdk", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes ClearSale with app key and session id on script load", () => {
    const csdp = vi.fn();
    const appendChild = vi.fn();
    let onload: (() => void) | null = null;

    const script = {
      async: false,
      src: "",
      set onload(handler: (() => void) | null) {
        onload = handler;
      },
      remove: vi.fn(),
    } as unknown as HTMLScriptElement;

    const documentRef = {
      createElement: vi.fn(() => script),
      head: { appendChild },
    } as unknown as Document;

    injectClearSaleSdk({
      sessionId: "session-123",
      appKey: "app-key",
      documentRef,
      windowRef: { csdp } as Window & { csdp: typeof csdp },
    });

    expect(appendChild).toHaveBeenCalledWith(script);
    expect(script.src).toContain("device.clearsale.com.br/p/fp.js");
    expect(script.async).toBe(true);

    onload?.();

    expect(csdp).toHaveBeenNthCalledWith(1, "app", "app-key");
    expect(csdp).toHaveBeenNthCalledWith(2, "sessionid", "session-123");
  });

  it("invokes onLoadFailed when script fails to load", () => {
    const onLoadFailed = vi.fn();
    let onerror: (() => void) | null = null;

    const script = {
      async: false,
      src: "",
      set onerror(handler: (() => void) | null) {
        onerror = handler;
      },
      remove: vi.fn(),
    } as unknown as HTMLScriptElement;

    const documentRef = {
      createElement: vi.fn(() => script),
      head: { appendChild: vi.fn() },
    } as unknown as Document;

    injectClearSaleSdk({
      sessionId: "session-456",
      appKey: "app-key",
      documentRef,
      windowRef: {} as Window & { csdp?: (...args: unknown[]) => void },
      onLoadFailed,
    });

    onerror?.();
    expect(onLoadFailed).toHaveBeenCalledTimes(1);
  });

  it("returns cleanup that removes the script and supports custom createScript", () => {
    const onInitialized = vi.fn();
    let onload: (() => void) | null = null;
    const remove = vi.fn();
    const script = {
      async: false,
      src: "",
      set onload(handler: (() => void) | null) {
        onload = handler;
      },
      remove,
    } as unknown as HTMLScriptElement;

    const cleanup = injectClearSaleSdk({
      sessionId: "session-789",
      appKey: "app-key",
      documentRef: {
        createElement: vi.fn(),
        head: { appendChild: vi.fn() },
      } as unknown as Document,
      windowRef: { csdp: vi.fn() } as Window & { csdp: ReturnType<typeof vi.fn> },
      createScript: () => script,
      onInitialized,
    });

    onload?.();
    expect(onInitialized).toHaveBeenCalled();
    cleanup();
    expect(remove).toHaveBeenCalled();
  });
});
