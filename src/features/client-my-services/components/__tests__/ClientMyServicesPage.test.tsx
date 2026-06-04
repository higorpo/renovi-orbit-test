import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ServiceRequestCardModel } from "../../types/client-my-services.types";
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
          <button
            type="button"
            data-testid="stub-keep-open-budgets"
            onClick={() => {
              onOpenChange(true);
            }}
          >
            keep budgets open
          </button>
        </div>
      ) : null,
  };
});

vi.mock("../OpenServiceDetailsSheet", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../OpenServiceDetailsSheet")>();
  return {
    ...mod,
    OpenServiceDetailsSheet: ({
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
            data-testid="stub-close-open-details"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            close open details
          </button>
          <button
            type="button"
            data-testid="stub-keep-open-details"
            onClick={() => {
              onOpenChange(true);
            }}
          >
            keep details open
          </button>
        </div>
      ) : null,
  };
});

const useClientMyServicesList = vi.mocked(
  await import("../../hooks/useClientMyServicesList").then((m) => m.useClientMyServicesList)
);

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

  it("shows error state when isError", () => {
    useClientMyServicesList.mockReturnValue({
      items: [],
      isLoading: false,
      isFetchingNextPage: false,
      isError: true,
      hasNextPage: false,
      totalCount: 0,
      fetchNextPage: vi.fn(async () => undefined),
      refetch: vi.fn(),
    });
    render(<ClientMyServicesPage />, { wrapper: createWrapper() });
    expect(
      screen.getByRole("heading", { name: /Não foi possível carregar seus serviços/i })
    ).toBeInTheDocument();
  });

  it("shows empty state when no items", () => {
    useClientMyServicesList.mockReturnValue({
      items: [],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: false,
      totalCount: 0,
      fetchNextPage: vi.fn(async () => undefined),
      refetch: vi.fn(),
    });
    render(<ClientMyServicesPage />, { wrapper: createWrapper() });
    expect(
      screen.getByRole("heading", {
        name: /Você ainda não solicitou nenhum serviço/i,
      })
    ).toBeInTheDocument();
  });

  it("when serviceRequestId is in the URL, lists only that service request", () => {
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});

    const focused: ServiceRequestCardModel = {
      id: "sr-focus",
      title: "Serviço focado",
      description: null,
      descriptionPreview: "",
      formData: null,
      formSchema: null,
      listPhase: "negotiation",
      statusTabId: "negotiation",
      createdAt: "2025-03-01T00:00:00Z",
      updatedAt: "2025-03-01T00:00:00Z",
      address: null,
      service: { title: "Eletricista", slug: "eletricista" },
      photoPaths: [],
    };
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
    expect(
      screen.getByRole("button", { name: /Ver todos os serviços/i })
    ).toBeInTheDocument();
  });

  it("shows no filter results when focus is active but list is empty", () => {
    useClientMyServicesList.mockReturnValue({
      items: [],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: false,
      totalCount: 0,
      fetchNextPage: vi.fn(async () => undefined),
      refetch: vi.fn(),
    });

    render(<ClientMyServicesPage />, {
      wrapper: createWrapper(["/dashboard/requests?serviceRequestId=missing"]),
    });

    expect(
      screen.getByRole("heading", { name: /Nenhum serviço encontrado/i })
    ).toBeInTheDocument();
  });

  it("shows load more when there are items and a next page", () => {
    const item: ServiceRequestCardModel = {
      id: "sr-1",
      title: "Serviço",
      description: null,
      descriptionPreview: "",
      formData: null,
      formSchema: null,
      listPhase: "negotiation",
      statusTabId: "negotiation",
      createdAt: "2025-03-01T00:00:00Z",
      updatedAt: "2025-03-01T00:00:00Z",
      address: null,
      service: { title: "Eletricista", slug: "eletricista" },
      photoPaths: [],
    };
    const fetchNextPage = vi.fn(async () => undefined);
    useClientMyServicesList.mockReturnValue({
      items: [item],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: true,
      totalCount: 40,
      fetchNextPage,
      refetch: vi.fn(),
    });

    render(<ClientMyServicesPage />, { wrapper: createWrapper() });
    const loadMore = screen.getByRole("button", { name: /Carregar mais/i });
    loadMore.click();
    expect(fetchNextPage).toHaveBeenCalled();
  });

  it("passes new status tab to list hook when user selects a tab", () => {
    render(<ClientMyServicesPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("tab", { name: /Em andamento/i }));
    const tabIds = useClientMyServicesList.mock.calls.map((c) => c[0].statusTabId);
    expect(tabIds.some((id) => id === "in_progress")).toBe(true);
  });

  it("retries load when error state button is clicked", () => {
    const refetch = vi.fn();
    useClientMyServicesList.mockReturnValue({
      items: [],
      isLoading: false,
      isFetchingNextPage: false,
      isError: true,
      hasNextPage: false,
      totalCount: 0,
      fetchNextPage: vi.fn(async () => undefined),
      refetch,
    });
    render(<ClientMyServicesPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("closes budget sheet via onOpenChange", () => {
    const item: ServiceRequestCardModel = {
      id: "sr-1",
      title: "Serviço",
      description: null,
      descriptionPreview: "",
      formData: null,
      formSchema: null,
      listPhase: "negotiation",
      statusTabId: "negotiation",
      createdAt: "2025-03-01T00:00:00Z",
      updatedAt: "2025-03-01T00:00:00Z",
      address: null,
      service: { title: "Eletricista", slug: "eletricista" },
      photoPaths: [],
      proposalCount: 2,
    };
    useClientMyServicesList.mockReturnValue({
      items: [item],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: false,
      totalCount: 1,
      fetchNextPage: vi.fn(async () => undefined),
      refetch: vi.fn(),
    });
    render(<ClientMyServicesPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Comparar or\u00e7amentos/i }));
    fireEvent.click(screen.getByTestId("stub-close-budgets"));
  });

  it("does not clear budget sheet when onOpenChange reports stay open", () => {
    const item: ServiceRequestCardModel = {
      id: "sr-2",
      title: "Aberto",
      description: null,
      descriptionPreview: "",
      formData: null,
      formSchema: null,
      listPhase: "negotiation",
      statusTabId: "negotiation",
      createdAt: "2025-03-01T00:00:00Z",
      updatedAt: "2025-03-01T00:00:00Z",
      address: null,
      service: { title: "Pintura", slug: "pintura" },
      photoPaths: [],
      proposalCount: 2,
    };
    useClientMyServicesList.mockReturnValue({
      items: [item],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: false,
      totalCount: 1,
      fetchNextPage: vi.fn(async () => undefined),
      refetch: vi.fn(),
    });
    render(<ClientMyServicesPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Comparar or\u00e7amentos/i }));
    fireEvent.click(screen.getByTestId("stub-keep-open-budgets"));
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes/i }));
    fireEvent.click(screen.getByTestId("stub-keep-open-details"));
  });

  it("closes open-service details sheet via onOpenChange", () => {
    const item: ServiceRequestCardModel = {
      id: "sr-2",
      title: "Aberto",
      description: null,
      descriptionPreview: "",
      formData: null,
      formSchema: null,
      listPhase: "negotiation",
      statusTabId: "negotiation",
      createdAt: "2025-03-01T00:00:00Z",
      updatedAt: "2025-03-01T00:00:00Z",
      address: null,
      service: { title: "Pintura", slug: "pintura" },
      photoPaths: [],
    };
    useClientMyServicesList.mockReturnValue({
      items: [item],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: false,
      totalCount: 1,
      fetchNextPage: vi.fn(async () => undefined),
      refetch: vi.fn(),
    });
    render(<ClientMyServicesPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes/i }));
    fireEvent.click(screen.getByTestId("stub-close-open-details"));
  });
});
