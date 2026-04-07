import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientMyServicesPage } from "../useClientMyServicesPage";
import { useClientMyServicesList } from "../useClientMyServicesList";
import type { ServiceRequestCardModel } from "../../types/client-my-services.types";

vi.mock("../useClientMyServicesList", () => ({
  useClientMyServicesList: vi.fn(),
}));

vi.mock("../useClientMyServicesCancel", () => ({
  useClientMyServicesCancel: vi.fn(() => ({
    cancelServiceRequest: vi.fn(),
    isCancelling: false,
  })),
}));

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

vi.mock("sonner", () => ({
  toast: { info: vi.fn() },
}));

const mockUseList = vi.mocked(useClientMyServicesList);
const { toast } = await import("sonner");

const openModel: ServiceRequestCardModel = {
  id: "sr-open",
  title: "Open job",
  description: null,
  descriptionPreview: "",
  formData: null,
  formSchema: null,
  status: "open",
  statusTabId: "waiting_proposals",
  createdAt: "2025-03-01T00:00:00Z",
  updatedAt: "2025-03-01T00:00:00Z",
  address: null,
  service: null,
  photoPaths: [],
};

const defaultListReturn = {
  items: [] as ServiceRequestCardModel[],
  isLoading: false,
  isFetchingNextPage: false,
  isError: false,
  hasNextPage: false,
  totalCount: 0,
  fetchNextPage: vi.fn(async () => undefined),
  refetch: vi.fn(),
};

function wrapper(initialEntries: string[]) {
  return function W({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe("useClientMyServicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseList.mockReturnValue(defaultListReturn);
  });

  it("clears focus query param via handleClearFocusFilter", () => {
    const { result } = renderHook(() => useClientMyServicesPage(), {
      wrapper: wrapper(["/dashboard/requests?serviceRequestId=sr-1"]),
    });

    expect(result.current.focusServiceRequestId).toBe("sr-1");

    act(() => {
      result.current.handleClearFocusFilter();
    });

    expect(result.current.focusServiceRequestId).toBeNull();
  });

  it("opens details sheet for open status and shows toast for other statuses", () => {
    const { result } = renderHook(() => useClientMyServicesPage(), {
      wrapper: wrapper(["/dashboard/requests"]),
    });

    act(() => {
      result.current.handleOpenDetails(openModel);
    });
    expect(result.current.selectedOpenService).toEqual(openModel);

    act(() => {
      result.current.setSelectedOpenService(null);
    });

    act(() => {
      result.current.handleOpenDetails({ ...openModel, status: "closed" });
    });
    expect(toast.info).toHaveBeenCalledWith(
      "Visualização detalhada para este status ainda está em construção."
    );
  });

  it("syncs status tab from focused request status", async () => {
    mockUseList.mockReturnValue({
      ...defaultListReturn,
      items: [{ ...openModel, id: "sr-x", status: "in_progress", statusTabId: "in_progress" }],
    });

    const { result } = renderHook(() => useClientMyServicesPage(), {
      wrapper: wrapper(["/dashboard/requests?serviceRequestId=sr-x"]),
    });

    await waitFor(() => expect(result.current.filters.statusTabId).toBe("in_progress"));
  });

  it("scrolls focused card into view once when list has single item", () => {
    const target = document.createElement("div");
    target.id = "service-request-sr-scroll";
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;
    const gbid = vi.spyOn(document, "getElementById").mockReturnValue(target);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    mockUseList.mockReturnValue({
      ...defaultListReturn,
      items: [{ ...openModel, id: "sr-scroll" }],
    });

    const { rerender } = renderHook(() => useClientMyServicesPage(), {
      wrapper: wrapper(["/dashboard/requests?serviceRequestId=sr-scroll"]),
    });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    mockUseList.mockReturnValue({
      ...defaultListReturn,
      items: [{ ...openModel, id: "sr-scroll", title: "Updated title" }],
    });
    rerender();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    gbid.mockRestore();
  });

  it("handleClearFilters resets filter fields and focus param", () => {
    const { result } = renderHook(() => useClientMyServicesPage(), {
      wrapper: wrapper(["/dashboard/requests?serviceRequestId=sr-1"]),
    });

    act(() => {
      result.current.setCategoryId("Cat");
      result.current.handleClearFilters();
    });

    expect(result.current.filters.categoryId).toBeNull();
    expect(result.current.focusServiceRequestId).toBeNull();
  });

  it("exposes category/city/neighborhood options derived from items", () => {
    mockUseList.mockReturnValue({
      ...defaultListReturn,
      items: [
        {
          ...openModel,
          address: {
            neighborhood: "Centro",
            cityName: "Florianópolis",
          },
          service: { title: "Pintura", slug: "pintura" },
        },
      ],
    });

    const { result } = renderHook(() => useClientMyServicesPage(), {
      wrapper: wrapper(["/dashboard/requests"]),
    });

    expect(result.current.categoryOptions).toContain("Pintura");
    expect(result.current.cityOptions).toContain("Florianópolis");
    expect(result.current.neighborhoodOptions).toContain("Centro");
  });

  it("handleOpenBudgets and handleOpenQuestions set sheet mode", () => {
    const { result } = renderHook(() => useClientMyServicesPage(), {
      wrapper: wrapper(["/dashboard/requests"]),
    });

    act(() => {
      result.current.handleOpenBudgets("sr-b");
    });
    expect(result.current.detailsMode).toBe("budgets");
    expect(result.current.selectedServiceRequestId).toBe("sr-b");

    act(() => {
      result.current.handleOpenQuestions("sr-q");
    });
    expect(result.current.detailsMode).toBe("questions");
    expect(result.current.selectedServiceRequestId).toBe("sr-q");
  });
});
