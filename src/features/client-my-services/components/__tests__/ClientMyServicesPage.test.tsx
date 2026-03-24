import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
      status: "open",
      statusTabId: "waiting_proposals",
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
});
