// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ServiceModel } from "@/features/view-services";
import { MyServicesPageShell } from "../MyServicesPageShell";
import type { MyServicesFilterState } from "../../types/my-services.types";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => true,
}));

const filters: MyServicesFilterState = {
  statusTabId: "all",
  searchQuery: "",
  categoryId: null,
  cityName: null,
  neighborhoodName: null,
  dateFrom: null,
  dateTo: null,
  hasProposals: null,
  hasImages: null,
};

const model: ServiceModel = {
  id: "sr-1",
  title: "Troca de chuveiro",
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

const baseProps = {
  header: <h1>Meus serviços</h1>,
  emptyState: <p>Nenhum serviço ainda</p>,
  filters,
  searchQuery: "",
  onSearchQueryChange: vi.fn(),
  onStatusTabChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onCityChange: vi.fn(),
  onNeighborhoodChange: vi.fn(),
  onDateRangeChange: vi.fn(),
  onHasProposalsChange: vi.fn(),
  onHasImagesChange: vi.fn(),
  categoryOptions: [] as string[],
  cityOptions: [] as string[],
  neighborhoodOptions: [] as string[],
  items: [] as ServiceModel[],
  isLoading: false,
  isFetchingNextPage: false,
  isError: false,
  hasActiveFilters: false,
  hasNextPage: false,
  onRetry: vi.fn(),
  onClearFilters: vi.fn(),
  onLoadMore: vi.fn(),
  renderCard: (item: ServiceModel) => <div>{item.title}</div>,
};

describe("MyServicesPageShell", () => {
  it("shows skeletons while loading", () => {
    const { container } = render(<MyServicesPageShell {...baseProps} isLoading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.queryByText("Nenhum serviço ainda")).toBeNull();
  });

  it("shows the error state and retries", () => {
    const onRetry = vi.fn();
    render(<MyServicesPageShell {...baseProps} isError onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows empty state when there are no items and no filters", () => {
    render(<MyServicesPageShell {...baseProps} />);
    expect(screen.getByText("Nenhum serviço ainda")).toBeTruthy();
  });

  it("shows no-filter-results when filters are active and list is empty", () => {
    const onClearFilters = vi.fn();
    render(
      <MyServicesPageShell
        {...baseProps}
        hasActiveFilters
        onClearFilters={onClearFilters}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it("renders cards and load more when there is a next page", () => {
    const onLoadMore = vi.fn();
    render(
      <MyServicesPageShell
        {...baseProps}
        items={[model]}
        hasNextPage
        onLoadMore={onLoadMore}
      />,
    );

    expect(screen.getByText("Troca de chuveiro")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/i }));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});
