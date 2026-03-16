import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDeleteAccount } from "../useDeleteAccount";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useDeleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns requestDelete and isDeleting", () => {
    const { result } = renderHook(() => useDeleteAccount());
    expect(typeof result.current.requestDelete).toBe("function");
    expect(result.current.isDeleting).toBe(false);
  });

  it("sets isDeleting true then false and shows info toast on requestDelete", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDeleteAccount());
    expect(result.current.isDeleting).toBe(false);

    await act(async () => {
      result.current.requestDelete();
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.isDeleting).toBe(false);
    expect(toast.info).toHaveBeenCalledWith(
      "Exclusão de conta ainda não disponível. Entre em contato com o suporte."
    );
    expect(toast.error).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("shows error toast when requestDelete throws", async () => {
    const { result } = renderHook(() => useDeleteAccount());
    const originalSetTimeout = global.setTimeout;
    vi.spyOn(global, "setTimeout").mockImplementation((fn: TimerHandler) => {
      if (typeof fn === "function") {
        queueMicrotask(() => (fn as () => void)());
      }
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    vi.mocked(toast.info).mockImplementation(() => {
      throw new Error("toast error");
    });

    await act(async () => {
      result.current.requestDelete();
    });

    expect(toast.error).toHaveBeenCalledWith("Não foi possível processar a solicitação.");
    vi.restoreAllMocks();
  });
});
