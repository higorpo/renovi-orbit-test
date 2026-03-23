import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ServiceRequestCardModel } from "../../types/service-request-view.types";
import { ServiceRequestsPage } from "../ServiceRequestsPage";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "user-1" }, profile: { role: "client" } })),
}));

vi.mock("../../hooks/useServiceRequestsList", () => ({
  useServiceRequestsList: vi.fn(),
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

const useServiceRequestsList = vi.mocked(
  await import("../../hooks/useServiceRequestsList").then((m) => m.useServiceRequestsList)
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

describe("ServiceRequestsPage", () => {
  beforeEach(() => {
    vi.mocked(useServiceRequestsList).mockReturnValue({
      items: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("renders header and search", () => {
    render(<ServiceRequestsPage />, { wrapper: createWrapper() });
    expect(screen.getByRole("heading", { name: /Meus Serviços/i })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: /Buscar serviço/i })).toBeInTheDocument();
  });

  it("shows loading skeletons when loading", () => {
    useServiceRequestsList.mockReturnValue({
      items: [],
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ServiceRequestsPage />, { wrapper: createWrapper() });
    const section = screen.getByRole("region", { name: /Lista de serviços/i });
    const list = section.querySelector("ul");
    expect(list).toHaveAttribute("aria-busy", "true");
  });

  it("shows error state when isError", () => {
    useServiceRequestsList.mockReturnValue({
      items: [],
      isLoading: false,
      isError: true,
      error: "Network error",
      refetch: vi.fn(),
    });
    render(<ServiceRequestsPage />, { wrapper: createWrapper() });
    expect(
      screen.getByRole("heading", { name: /Não foi possível carregar seus serviços/i })
    ).toBeInTheDocument();
  });

  it("shows empty state when no items", () => {
    useServiceRequestsList.mockReturnValue({
      items: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ServiceRequestsPage />, { wrapper: createWrapper() });
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
      status: "open",
      statusTabId: "waiting_proposals",
      createdAt: "2025-03-01T00:00:00Z",
      updatedAt: "2025-03-01T00:00:00Z",
      address: null,
      service: { title: "Eletricista", slug: "eletricista" },
      photoPaths: [],
    };
    const other: ServiceRequestCardModel = {
      ...focused,
      id: "sr-other",
      title: "Outro pedido",
    };

    useServiceRequestsList.mockReturnValue({
      items: [focused, other],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ServiceRequestsPage />, {
      wrapper: createWrapper(["/dashboard/requests?serviceRequestId=sr-focus"]),
    });

    expect(screen.queryByText("Outro pedido")).not.toBeInTheDocument();
    expect(document.getElementById("service-request-sr-focus")).toBeTruthy();
    expect(screen.getAllByText("Serviço focado").length).toBeGreaterThan(0);
    expect(screen.getByText("Filtro ativo: um pedido")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ver todos os serviços/i })
    ).toBeInTheDocument();
  });
});
