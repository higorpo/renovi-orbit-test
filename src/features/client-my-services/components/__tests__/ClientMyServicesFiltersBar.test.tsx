import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientMyServicesFiltersBar } from "../ClientMyServicesFiltersBar";
import type { ServiceRequestsFilterState } from "../../types/client-my-services.types";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: vi.fn(),
}));

const { useBreakpointMd } = await import("@/hooks/useBreakpoint");

const baseFilters: ServiceRequestsFilterState = {
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

describe("ClientMyServicesFiltersBar", () => {
  beforeEach(() => {
    vi.mocked(useBreakpointMd).mockReturnValue(true);
  });

  it("desktop: opens popover and updates category filter", () => {
    const onCategoryChange = vi.fn();
    render(
      <ClientMyServicesFiltersBar
        filters={baseFilters}
        onCategoryChange={onCategoryChange}
        onCityChange={vi.fn()}
        onNeighborhoodChange={vi.fn()}
        onDateRangeChange={vi.fn()}
        onHasProposalsChange={vi.fn()}
        onHasImagesChange={vi.fn()}
        categoryOptions={["Eletricista"]}
        cityOptions={[]}
        neighborhoodOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    const select = screen.getByLabelText(/Filtrar por categoria/i);
    fireEvent.change(select, { target: { value: "Eletricista" } });
    expect(onCategoryChange).toHaveBeenCalledWith("Eletricista");
  });

  it("mobile: renders sheet layout and clears filters", () => {
    vi.mocked(useBreakpointMd).mockReturnValue(false);
    const onCategoryChange = vi.fn();
    const onCityChange = vi.fn();
    const onNeighborhoodChange = vi.fn();
    const onDateRangeChange = vi.fn();
    const onHasProposalsChange = vi.fn();
    const onHasImagesChange = vi.fn();

    render(
      <ClientMyServicesFiltersBar
        filters={{ ...baseFilters, categoryId: "Pintura" }}
        onCategoryChange={onCategoryChange}
        onCityChange={onCityChange}
        onNeighborhoodChange={onNeighborhoodChange}
        onDateRangeChange={onDateRangeChange}
        onHasProposalsChange={onHasProposalsChange}
        onHasImagesChange={onHasImagesChange}
        categoryOptions={["Pintura"]}
        cityOptions={[]}
        neighborhoodOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    const clearButtons = screen.getAllByRole("button", { name: /Limpar/i });
    fireEvent.click(clearButtons[0]);

    expect(onCategoryChange).toHaveBeenCalledWith(null);
    expect(onCityChange).toHaveBeenCalledWith(null);
    expect(onNeighborhoodChange).toHaveBeenCalledWith(null);
    expect(onDateRangeChange).toHaveBeenCalledWith(null, null);
    expect(onHasProposalsChange).toHaveBeenCalledWith(null);
    expect(onHasImagesChange).toHaveBeenCalledWith(null);
  });

  it("locks body overflow on mobile while sheet is open", () => {
    vi.mocked(useBreakpointMd).mockReturnValue(false);
    const prev = document.body.style.overflow;
    render(
      <ClientMyServicesFiltersBar
        filters={baseFilters}
        onCategoryChange={vi.fn()}
        onCityChange={vi.fn()}
        onNeighborhoodChange={vi.fn()}
        onDateRangeChange={vi.fn()}
        onHasProposalsChange={vi.fn()}
        onHasImagesChange={vi.fn()}
        categoryOptions={[]}
        cityOptions={[]}
        neighborhoodOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    expect(document.body.style.overflow).toBe("hidden");
    document.body.style.overflow = prev;
  });

  it("mobile: updates city, neighborhood, dates, proposals, and photos filters", () => {
    vi.mocked(useBreakpointMd).mockReturnValue(false);
    const onCityChange = vi.fn();
    const onNeighborhoodChange = vi.fn();
    const onDateRangeChange = vi.fn();
    const onHasProposalsChange = vi.fn();
    const onHasImagesChange = vi.fn();

    render(
      <ClientMyServicesFiltersBar
        filters={baseFilters}
        onCategoryChange={vi.fn()}
        onCityChange={onCityChange}
        onNeighborhoodChange={onNeighborhoodChange}
        onDateRangeChange={onDateRangeChange}
        onHasProposalsChange={onHasProposalsChange}
        onHasImagesChange={onHasImagesChange}
        categoryOptions={[]}
        cityOptions={["Florian\u00f3polis"]}
        neighborhoodOptions={["Centro"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));

    fireEvent.change(screen.getByLabelText(/Filtrar por cidade/i), {
      target: { value: "Florian\u00f3polis" },
    });
    expect(onCityChange).toHaveBeenCalledWith("Florian\u00f3polis");

    fireEvent.change(screen.getByLabelText(/Filtrar por bairro/i), {
      target: { value: "Centro" },
    });
    expect(onNeighborhoodChange).toHaveBeenCalledWith("Centro");

    const dateFrom = screen.getByLabelText(/Data inicial/i);
    const dateTo = screen.getByLabelText(/Data final/i);
    fireEvent.change(dateFrom, { target: { value: "2025-01-01" } });
    fireEvent.change(dateTo, { target: { value: "2025-01-31" } });
    expect(onDateRangeChange).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Filtrar por exist\u00eancia de or\u00e7amentos/i), {
      target: { value: "yes" },
    });
    expect(onHasProposalsChange).toHaveBeenCalledWith(true);

    fireEvent.change(screen.getByLabelText(/Filtrar por exist\u00eancia de fotos/i), {
      target: { value: "no" },
    });
    expect(onHasImagesChange).toHaveBeenCalledWith(false);
  });
});
