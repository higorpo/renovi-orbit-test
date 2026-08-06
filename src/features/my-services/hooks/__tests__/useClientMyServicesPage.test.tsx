import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceModel } from "@/features/view-services";
import { useClientMyServicesPage } from "../useClientMyServicesPage";
import { useMyServicesList } from "../useMyServicesList";

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../useMyServicesList", () => ({
  useMyServicesList: vi.fn(),
}));

vi.mock("../useClientMyServicesCancel", () => ({
  useClientMyServicesCancel: vi.fn(() => ({
    cancelServiceRequest: vi.fn(),
    isCancelling: false,
  })),
}));

const openEvaluateService = vi.fn();

vi.mock("../useClientEvaluateServiceDialog", () => ({
  useClientEvaluateServiceDialog: () => ({
    open: false,
    model: null,
    openEvaluateService,
    handleOpenChange: vi.fn(),
    handleCompleted: vi.fn(),
  }),
}));

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

const mockUseList = vi.mocked(useMyServicesList);

const openModel: ServiceModel = {
  id: "sr-open",
  title: "Open job",
  description: null,
  descriptionPreview: "",
  formData: null,
  formSchema: null,
  listPhase: "negotiation",
  statusTabId: "negotiation",
  contractedServiceId: null,
  createdAt: "2025-03-01T00:00:00Z",
  updatedAt: "2025-03-01T00:00:00Z",
  address: null,
  service: null,
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
};

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
      wrapper: wrapper(["/dashboard/services?serviceRequestId=sr-1"]),
    });

    expect(result.current.focusServiceRequestId).toBe("sr-1");

    act(() => {
      result.current.handleClearFocusFilter();
    });

    expect(result.current.focusServiceRequestId).toBeNull();
  });

  it("navigates to service detail for any list phase", () => {
    const { result } = renderHook(() => useClientMyServicesPage(), {
      wrapper: wrapper(["/dashboard/services"]),
    });

    act(() => {
      result.current.handleOpenDetails(openModel);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/services/sr-open", {
      state: expect.objectContaining({
        serviceDetailPresentation: "sheet",
        returnTo: "/dashboard/services",
        myServicesRole: "client",
      }),
    });

    act(() => {
      result.current.handleOpenDetails({ ...openModel, id: "sr-done", listPhase: "completed" });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/services/sr-done", {
      state: expect.objectContaining({
        myServicesRole: "client",
      }),
    });
  });

  it("navigates to chats list and conversation from card actions", () => {
    const { result } = renderHook(() => useClientMyServicesPage(), {
      wrapper: wrapper(["/dashboard/services"]),
    });

    act(() => {
      result.current.handleOpenMessages(openModel);
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("serviceRequestId=sr-open"),
    );

    act(() => {
      result.current.handleOpenChat(openModel);
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleOpenChat({
        ...openModel,
        chatSummary: {
          id: "chat-9",
          isUnread: false,
          lastInteractionAt: "2025-03-02T00:00:00Z",
          lastMessagePreview: null,
          providerDisplayName: "João",
        },
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/chats/chat-9");
  });

  it("delegates evaluate service action to the dialog controller", () => {
    const { result } = renderHook(() => useClientMyServicesPage(), {
      wrapper: wrapper(["/dashboard/services"]),
    });

    act(() => {
      result.current.handleEvaluateService(openModel);
    });

    expect(openEvaluateService).toHaveBeenCalledWith(openModel);
  });

  it("clears focus together with other filters", () => {
    const { result } = renderHook(() => useClientMyServicesPage(), {
      wrapper: wrapper(["/dashboard/services?serviceRequestId=sr-1&status=negotiation"]),
    });

    act(() => {
      result.current.handleClearFilters();
    });

    expect(result.current.focusServiceRequestId).toBeNull();
  });

  it("syncs status tab from focused request status", async () => {
    mockUseList.mockReturnValue({
      ...defaultListReturn,
      items: [{ ...openModel, id: "sr-x", listPhase: "in_progress", statusTabId: "in_progress" }],
    });

    const { result } = renderHook(() => useClientMyServicesPage(), {
      wrapper: wrapper(["/dashboard/services?serviceRequestId=sr-x"]),
    });

    await waitFor(() => {
      expect(result.current.filters.statusTabId).toBe("in_progress");
    });
  });
});
