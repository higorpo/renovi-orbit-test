import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ServiceModel } from "@/features/view-services";
import { ClientMyServicesPage } from "../ClientMyServicesPage";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "user-1" }, profile: { role: "client" } })),
}));

vi.mock("../../hooks/useClientMyServicesList", () => ({
  useClientMyServicesList: vi.fn(),
}));

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: vi.fn((value: string) => value),
}));

vi.mock("@/features/request-quote", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/request-quote")>();
  return {
    ...actual,
    useServiceRequestPhotoUrls: vi.fn(() => ({ urls: [], isLoading: false })),
  };
});

vi.mock("@/features/negotiation-proposals", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/features/negotiation-proposals")>();
  return {
    ...mod,
    ReceivedBudgetDetailsSheet: ({
      open,
      onOpenChange,
    }: {
      open: boolean;
      onOpenChange: (v: boolean) => void;
    }) =>
      open ? (
        <div>
          <button
            type="button"
            data-testid="stub-close-budgets"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            close budgets
          </button>
        </div>
      ) : null,
  };
});

const useClientMyServicesList = vi.mocked(
  await import("../../hooks/useClientMyServicesList").then((m) => m.useClientMyServicesList),
);

function baseModel(overrides: Partial<ServiceModel> = {}): ServiceModel {
  return {
    id: "sr-1",
    title: "Serviço",
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
    ...overrides,
  };
}

function createWrapper(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe("ClientMyServicesPage", () => {
  beforeEach(() => {
    vi.mocked(useClientMyServicesList).mockReturnValue({
      items: [],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: false,
      totalCount: 0,
      fetchNextPage: vi.fn(async () => undefined),
      refetch: vi.fn(),
    });
  });

  it("renders header and search", () => {
    render(<ClientMyServicesPage />, { wrapper: createWrapper() });
    expect(screen.getByRole("heading", { name: /Meus Serviços/i })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: /Buscar serviço/i })).toBeInTheDocument();
  });

  it("shows loading skeletons when loading", () => {
    useClientMyServicesList.mockReturnValue({
      items: [],
      isLoading: true,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: false,
      totalCount: 0,
      fetchNextPage: vi.fn(async () => undefined),
      refetch: vi.fn(),
    });
    render(<ClientMyServicesPage />, { wrapper: createWrapper() });
    const section = screen.getByRole("region", { name: /Lista de serviços/i });
    const list = section.querySelector("ul");
    expect(list).toHaveAttribute("aria-busy", "true");
  });

  it("when serviceRequestId is in the URL, lists only that service request", () => {
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});

    const focused = baseModel({ id: "sr-focus", title: "Serviço focado" });
    useClientMyServicesList.mockReturnValue({
      items: [focused],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: false,
      totalCount: 1,
      fetchNextPage: vi.fn(async () => undefined),
      refetch: vi.fn(),
    });

    render(<ClientMyServicesPage />, {
      wrapper: createWrapper(["/dashboard/requests?serviceRequestId=sr-focus"]),
    });

    expect(document.getElementById("service-request-sr-focus")).toBeTruthy();
    expect(screen.getAllByText("Serviço focado").length).toBeGreaterThan(0);
    expect(screen.getByText("Filtro ativo: um pedido")).toBeInTheDocument();
  });

  it("shows load more when there are items and a next page", () => {
    const fetchNextPage = vi.fn(async () => undefined);
    useClientMyServicesList.mockReturnValue({
      items: [baseModel()],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: true,
      totalCount: 40,
      fetchNextPage,
      refetch: vi.fn(),
    });

    render(<ClientMyServicesPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/i }));
    expect(fetchNextPage).toHaveBeenCalled();
  });

  it("closes budget sheet via onOpenChange", () => {
    useClientMyServicesList.mockReturnValue({
      items: [baseModel({ proposalCount: 2 })],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: false,
      totalCount: 1,
      fetchNextPage: vi.fn(async () => undefined),
      refetch: vi.fn(),
    });
    render(<ClientMyServicesPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Comparar orçamentos/i }));
    fireEvent.click(screen.getByTestId("stub-close-budgets"));
  });
});
