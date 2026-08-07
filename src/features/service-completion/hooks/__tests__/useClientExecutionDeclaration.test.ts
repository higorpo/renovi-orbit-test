// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientExecutionDeclaration } from "../useClientExecutionDeclaration";

const recordExecutionDeclaration = vi.fn();
const collectDeviceDeclarationPayload = vi.fn();

vi.mock("../../api/declaration.api", () => ({
  recordExecutionDeclaration: (...args: unknown[]) =>
    recordExecutionDeclaration(...args),
}));

vi.mock("../../utils/collectDeviceDeclarationPayload", () => ({
  collectDeviceDeclarationPayload: (...args: unknown[]) =>
    collectDeviceDeclarationPayload(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  return createElement("div", null, children);
}

describe("useClientExecutionDeclaration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    collectDeviceDeclarationPayload.mockResolvedValue({
      deviceId: "d1",
      platform: "web",
      operatingSystem: null,
      osVersion: null,
      manufacturer: null,
      model: null,
      deviceName: null,
      isVirtual: false,
      webViewVersion: null,
      userAgent: "ua",
      clientTimezone: "UTC",
    });
    recordExecutionDeclaration.mockResolvedValue({
      data: {
        ok: true,
        id: "decl-1",
        contractedServiceId: "cs-1",
        declaredAt: "t",
        lastSeenAt: "t",
      },
      error: null,
    });
  });

  it("debounces persist on check and marks declarationPersisted", async () => {
    const { result } = renderHook(
      () =>
        useClientExecutionDeclaration({
          contractedServiceId: "cs-1",
          enabled: true,
        }),
      { wrapper },
    );

    act(() => {
      result.current.setChecked(true);
    });
    expect(recordExecutionDeclaration).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(recordExecutionDeclaration).toHaveBeenCalledTimes(1);
    expect(result.current.declarationPersisted).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("cancels debounce on uncheck before timer fires", async () => {
    const { result } = renderHook(
      () =>
        useClientExecutionDeclaration({
          contractedServiceId: "cs-1",
          enabled: true,
        }),
      { wrapper },
    );

    act(() => {
      result.current.setChecked(true);
    });
    act(() => {
      result.current.setChecked(false);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(recordExecutionDeclaration).not.toHaveBeenCalled();
    expect(result.current.declarationPersisted).toBe(false);
  });

  it("skips network after successful sync in the same mount", async () => {
    const { result } = renderHook(
      () =>
        useClientExecutionDeclaration({
          contractedServiceId: "cs-1",
          enabled: true,
        }),
      { wrapper },
    );

    act(() => {
      result.current.setChecked(true);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(recordExecutionDeclaration).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setChecked(false);
    });
    act(() => {
      result.current.setChecked(true);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(recordExecutionDeclaration).toHaveBeenCalledTimes(1);
    expect(result.current.declarationPersisted).toBe(true);
  });

  it("surfaces inline error and allows retry on re-check", async () => {
    recordExecutionDeclaration
      .mockResolvedValueOnce({ data: null, error: "boom" })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          id: "decl-2",
          contractedServiceId: "cs-1",
          declaredAt: "t",
          lastSeenAt: "t",
        },
        error: null,
      });

    const { result } = renderHook(
      () =>
        useClientExecutionDeclaration({
          contractedServiceId: "cs-1",
          enabled: true,
        }),
      { wrapper },
    );

    act(() => {
      result.current.setChecked(true);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.declarationPersisted).toBe(false);
    expect(result.current.error).toMatch(/declaracão|declaração/i);

    act(() => {
      result.current.setChecked(false);
    });
    act(() => {
      result.current.setChecked(true);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(recordExecutionDeclaration).toHaveBeenCalledTimes(2);
    expect(result.current.declarationPersisted).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
