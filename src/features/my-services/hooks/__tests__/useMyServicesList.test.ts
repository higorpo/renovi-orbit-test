// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMyServicesList } from "../useMyServicesList";
import { useServicesList } from "@/features/view-services";

vi.mock("@/features/view-services", () => ({
  useServicesList: vi.fn(),
}));

const mockUseServicesList = vi.mocked(useServicesList);

const baseParams = {
  statusTabId: "all" as const,
  search: "",
  categoryId: null as string | null,
  cityName: null as string | null,
  neighborhoodName: null as string | null,
  dateFrom: null as string | null,
  dateTo: null as string | null,
  hasProposals: null as boolean | null,
  hasImages: null as boolean | null,
  serviceRequestId: null as string | null,
};

describe("useMyServicesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseServicesList.mockReturnValue({
      items: [],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: false,
      totalCount: 0,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });
  });

  it("delegates to useServicesList from view-services", () => {
    renderHook(() => useMyServicesList(baseParams));
    expect(mockUseServicesList).toHaveBeenCalledWith(baseParams);
  });
});
