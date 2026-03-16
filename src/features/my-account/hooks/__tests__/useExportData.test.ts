import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExportData } from "../useExportData";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useExportData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns requestExport and isExporting", () => {
    const { result } = renderHook(() => useExportData());
    expect(typeof result.current.requestExport).toBe("function");
    expect(result.current.isExporting).toBe(false);
  });

  it("sets isExporting true then false and shows success toast on requestExport", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useExportData());
    expect(result.current.isExporting).toBe(false);

    await act(async () => {
      result.current.requestExport();
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.isExporting).toBe(false);
    expect(toast.success).toHaveBeenCalledWith(
      "Solicitação de exportação registrada. Você receberá um e-mail quando estiver pronta."
    );
    expect(toast.error).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("shows error toast when requestExport throws", async () => {
    const { result } = renderHook(() => useExportData());
    vi.spyOn(global, "setTimeout").mockImplementation((fn: TimerHandler) => {
      if (typeof fn === "function") {
        queueMicrotask(() => (fn as () => void)());
      }
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
    vi.mocked(toast.success).mockImplementation(() => {
      throw new Error("toast error");
    });

    await act(async () => {
      result.current.requestExport();
    });

    expect(toast.error).toHaveBeenCalledWith("Não foi possível solicitar a exportação.");
    vi.restoreAllMocks();
  });
});
