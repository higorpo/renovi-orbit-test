// @vitest-environment happy-dom
import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDisputeStub } from "../useDisputeStub";
import { DISPUTE_STUB_ANALYTICS_EVENT } from "../../utils/disputeSupportUrl";

const trackEvent = vi.fn();
const toastMessage = vi.fn();

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent }),
}));

vi.mock("sonner", () => ({
  toast: { message: (...args: unknown[]) => toastMessage(...args) },
}));

describe("useDisputeStub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    delete (window as { __ORBIT_REMOTE_CONFIG__?: unknown }).__ORBIT_REMOTE_CONFIG__;
  });

  it("fires analytics and toasts Em breve when URL unset (no crash, no mutation)", () => {
    vi.stubEnv("VITE_SERVICE_COMPLETION_DISPUTE_SUPPORT_URL", "");
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    const { result } = renderHook(() => useDisputeStub());
    let outcome: { openedUrl: boolean } | undefined;
    act(() => {
      outcome = result.current.openDisputeStub({
        contractedServiceId: "cs-1",
        csStatus: "EXECUTED",
      });
    });

    expect(trackEvent).toHaveBeenCalledWith(DISPUTE_STUB_ANALYTICS_EVENT, {
      contracted_service_id: "cs-1",
      cs_status: "EXECUTED",
    });
    expect(toastMessage).toHaveBeenCalledWith(
      "Em breve",
      expect.objectContaining({
        description: expect.stringMatching(/suporte Renovi/i),
      }),
    );
    expect(open).not.toHaveBeenCalled();
    expect(outcome?.openedUrl).toBe(false);

    open.mockRestore();
  });

  it("opens support URL after analytics when configured", () => {
    vi.stubEnv(
      "VITE_SERVICE_COMPLETION_DISPUTE_SUPPORT_URL",
      "https://wa.me/5500000000000",
    );
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    const { result } = renderHook(() => useDisputeStub());
    act(() => {
      result.current.openDisputeStub({
        contractedServiceId: "cs-9",
        csStatus: "COMPLETED",
      });
    });

    expect(trackEvent).toHaveBeenCalledWith(DISPUTE_STUB_ANALYTICS_EVENT, {
      contracted_service_id: "cs-9",
      cs_status: "COMPLETED",
    });
    expect(open).toHaveBeenCalledWith(
      "https://wa.me/5500000000000",
      "_blank",
      "noopener,noreferrer",
    );
    expect(toastMessage).not.toHaveBeenCalled();

    open.mockRestore();
  });
});
