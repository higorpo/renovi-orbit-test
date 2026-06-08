import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ServiceModel } from "@/features/view-services";
import { ProviderMyServicesPage } from "../ProviderMyServicesPage";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "provider-1" }, profile: { role: "provider" } })),
}));

vi.mock("../../../hooks/useMyServicesList", () => ({
  useMyServicesList: vi.fn(),
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

const useMyServicesList = vi.mocked(
  await import("../../../hooks/useMyServicesList").then((m) => m.useMyServicesList),
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
    proposalCount: 1,
    hasPendingProposal: true,
    counterpartyName: "Maria",
    counterparty: null,
    contracted: null,
    tags: null,
    urgency: null,
    scopeComplexity: null,
    estimatedDurationHint: null,
    missingInfoWarnings: null,
    suggestedEquipment: null,
    suggestedMaterials: null,
    lastActivityAt: "2025-03-02T00:00:00Z",
    myProposal: {
      id: "prop-1",
      status: "PENDING",
      finalAmount: 150,
      updatedAt: "2025-03-02T00:00:00Z",
      expiredAt: null,
    },
    chatSummary: { id: "chat-1", isUnread: false, lastInteractionAt: null },
    ...overrides,
  };
}

function createWrapper(initialEntries: string[] = ["/dashboard/services"]) {
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

describe("ProviderMyServicesPage", () => {
  beforeEach(() => {
    vi.mocked(useMyServicesList).mockReturnValue({
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

  it("renders provider header and search", () => {
    render(<ProviderMyServicesPage />, { wrapper: createWrapper() });
    expect(screen.getByRole("heading", { name: /Meus serviços/i })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: /Buscar serviço/i })).toBeInTheDocument();
  });

  it("shows empty state with link to jobs when list is empty", () => {
    render(<ProviderMyServicesPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Você ainda não enviou propostas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver trabalhos/i })).toHaveAttribute(
      "href",
      "/dashboard/jobs",
    );
  });

  it("renders provider cards when items exist", () => {
    useMyServicesList.mockReturnValue({
      items: [baseModel()],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: false,
      totalCount: 1,
      fetchNextPage: vi.fn(async () => undefined),
      refetch: vi.fn(),
    });

    render(<ProviderMyServicesPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Serviço")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver conversa/i })).toBeInTheDocument();
  });

  it("shows load more when there are items and a next page", () => {
    const fetchNextPage = vi.fn(async () => undefined);
    useMyServicesList.mockReturnValue({
      items: [baseModel()],
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: true,
      totalCount: 40,
      fetchNextPage,
      refetch: vi.fn(),
    });

    render(<ProviderMyServicesPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/i }));
    expect(fetchNextPage).toHaveBeenCalled();
  });
});
