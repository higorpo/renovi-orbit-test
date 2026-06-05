// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientMyServicesCancel } from "../useClientMyServicesCancel";
import { useCancelService } from "@/features/view-services";

vi.mock("@/features/view-services", () => ({
  useCancelService: vi.fn(),
}));

const mockUseCancelService = vi.mocked(useCancelService);

describe("useClientMyServicesCancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCancelService.mockReturnValue({
      cancelService: vi.fn(),
      isCancelling: false,
    });
  });

  it("delegates to useCancelService from view-services", () => {
    const cancelService = vi.fn();
    mockUseCancelService.mockReturnValue({
      cancelService,
      isCancelling: true,
    });

    const { result } = renderHook(() => useClientMyServicesCancel());

    expect(result.current.cancelServiceRequest).toBe(cancelService);
    expect(result.current.isCancelling).toBe(true);
  });
});
