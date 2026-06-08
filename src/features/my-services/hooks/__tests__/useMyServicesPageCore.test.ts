// @vitest-environment happy-dom
import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceModel } from "@/features/view-services";
import { useMyServicesPageCore } from "../useMyServicesPageCore";
import { useMyServicesList } from "../useMyServicesList";

vi.mock("../useMyServicesList", () => ({
  useMyServicesList: vi.fn(),
}));

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

const mockUseList = vi.mocked(useMyServicesList);

const baseModel = (overrides: Partial<ServiceModel> = {}): ServiceModel => ({
  id: "sr-1",
  title: "Job",
  description: null,
  descriptionPreview: "",
  formData: null,
  formSchema: null,
  listPhase: "negotiation",
  statusTabId: "negotiation",
  contractedServiceId: null,
  createdAt: "2025-03-01T00:00:00Z",
  updatedAt: "2025-03-01T00:00:00Z",
  address: { cityName: "Florianópolis", neighborhood: "Centro", stateCode: "SC" },
  service: { title: "Eletricista", slug: "eletricista" },
  photoPaths: [],
  proposalCount: 0,
  hasPendingProposal: false,
  counterpartyName: null,
  counterparty: null,
  contracted: null,
  tags: null,
  urgency: null,
  scopeComplexity: null,
  estimatedDurationHint: null,
  missingInfoWarnings: null,
  suggestedEquipment: null,
  suggestedMaterials: null,
  lastActivityAt: null,
  myProposal: null,
  chatSummary: null,
  ...overrides,
});

const defaultListReturn = {
  items: [] as ServiceModel[],
  isLoading: false,
  isFetchingNextPage: false,
  isError: false,
  hasNextPage: false,
  totalCount: 0,
  fetchNextPage: vi.fn(async () => undefined),
  refetch: vi.fn(),
};

describe("useMyServicesPageCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseList.mockReturnValue(defaultListReturn);
  });

  it("derives filter options from loaded items", () => {
    mockUseList.mockReturnValue({
      ...defaultListReturn,
      items: [
        baseModel(),
        baseModel({
          id: "sr-2",
          service: { title: "Pintor", slug: "pintor" },
          address: { cityName: "São José", neighborhood: "Kobrasol", stateCode: "SC" },
        }),
      ],
    });

    const { result } = renderHook(() => useMyServicesPageCore());

    expect(result.current.categoryOptions).toEqual(["Eletricista", "Pintor"]);
    expect(result.current.cityOptions).toEqual(["Florianópolis", "São José"]);
    expect(result.current.neighborhoodOptions).toEqual(["Centro", "Kobrasol"]);
  });

  it("marks hasActiveFilters when status tab or search changes", () => {
    const { result } = renderHook(() => useMyServicesPageCore());

    expect(result.current.hasActiveFilters).toBe(false);

    act(() => {
      result.current.setStatusTabId("in_progress");
    });
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.setStatusTabId("all");
      result.current.setSearchQuery("pintura");
    });
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("marks hasActiveFilters when focus serviceRequestId is set", () => {
    const { result } = renderHook(() =>
      useMyServicesPageCore({ serviceRequestId: "sr-focus" }),
    );
    expect(result.current.hasActiveFilters).toBe(true);
    expect(mockUseList).toHaveBeenCalledWith(
      expect.objectContaining({ serviceRequestId: "sr-focus" }),
    );
  });

  it("clears secondary filters via handleClearFilters", () => {
    const { result } = renderHook(() => useMyServicesPageCore());

    act(() => {
      result.current.setCategoryId("Eletricista");
      result.current.setCityName("Florianópolis");
      result.current.setHasProposals(true);
    });

    expect(result.current.filters.categoryId).toBe("Eletricista");

    act(() => {
      result.current.handleClearFilters();
    });

    expect(result.current.filters.categoryId).toBeNull();
    expect(result.current.filters.cityName).toBeNull();
    expect(result.current.filters.hasProposals).toBeNull();
  });
});
