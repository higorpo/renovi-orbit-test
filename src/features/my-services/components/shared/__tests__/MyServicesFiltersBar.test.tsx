import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MyServicesFiltersBar } from "../MyServicesFiltersBar";
import type { MyServicesFilterState } from "../../types/my-services.types";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: vi.fn(),
}));

const { useBreakpointMd } = await import("@/hooks/useBreakpoint");

const baseFilters: MyServicesFilterState = {
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

describe("MyServicesFiltersBar", () => {
  beforeEach(() => {
    vi.mocked(useBreakpointMd).mockReturnValue(true);
  });

  it("desktop: shows clear control when filters are active", () => {
    const onCategoryChange = vi.fn();
    render(
      <MyServicesFiltersBar
        filters={{ ...baseFilters, categoryId: "Pintura" }}
        onCategoryChange={onCategoryChange}
        onCityChange={vi.fn()}
        onNeighborhoodChange={vi.fn()}
        onDateRangeChange={vi.fn()}
        onHasProposalsChange={vi.fn()}
        onHasImagesChange={vi.fn()}
        categoryOptions={["Pintura"]}
        cityOptions={[]}
        neighborhoodOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    fireEvent.click(screen.getByRole("button", { name: /Limpar/i }));
    expect(onCategoryChange).toHaveBeenCalledWith(null);
  });

  it("desktop: opens popover and updates category filter", () => {
    const onCategoryChange = vi.fn();
    render(
      <MyServicesFiltersBar
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

  it("desktop: updates date range from popover", () => {
    const onDateRangeChange = vi.fn();
    render(
      <MyServicesFiltersBar
        filters={{ ...baseFilters, dateTo: "2025-02-01" }}
        onCategoryChange={vi.fn()}
        onCityChange={vi.fn()}
        onNeighborhoodChange={vi.fn()}
        onDateRangeChange={onDateRangeChange}
        onHasProposalsChange={vi.fn()}
        onHasImagesChange={vi.fn()}
        categoryOptions={[]}
        cityOptions={[]}
        neighborhoodOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    fireEvent.change(screen.getByLabelText(/Data inicial/i), {
      target: { value: "2025-01-01" },
    });
    expect(onDateRangeChange).toHaveBeenCalledWith("2025-01-01", "2025-02-01");
  });

  it("desktop: toggles proposals and photos selects including reset to any", () => {
    const onHasProposalsChange = vi.fn();
    const onHasImagesChange = vi.fn();
    render(
      <MyServicesFiltersBar
        filters={baseFilters}
        onCategoryChange={vi.fn()}
        onCityChange={vi.fn()}
        onNeighborhoodChange={vi.fn()}
        onDateRangeChange={vi.fn()}
        onHasProposalsChange={onHasProposalsChange}
        onHasImagesChange={onHasImagesChange}
        categoryOptions={[]}
        cityOptions={[]}
        neighborhoodOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));

    fireEvent.change(screen.getByLabelText(/Filtrar por existência de orçamentos/i), {
      target: { value: "no" },
    });
    expect(onHasProposalsChange).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByLabelText(/Filtrar por existência de fotos/i), {
      target: { value: "yes" },
    });
    expect(onHasImagesChange).toHaveBeenCalledWith(true);

    fireEvent.change(screen.getByLabelText(/Filtrar por existência de orçamentos/i), {
      target: { value: "" },
    });
    expect(onHasProposalsChange).toHaveBeenLastCalledWith(null);
  });

  it("desktop: reflects selected proposal and photo filter values", () => {
    render(
      <MyServicesFiltersBar
        filters={{ ...baseFilters, hasProposals: true, hasImages: false }}
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
    const proposalsSelect = screen.getByLabelText(
      /Filtrar por existência de orçamentos/i
    ) as HTMLSelectElement;
    const photosSelect = screen.getByLabelText(/Filtrar por existência de fotos/i) as HTMLSelectElement;
    expect(proposalsSelect.value).toBe("yes");
    expect(photosSelect.value).toBe("no");
  });

  it("desktop: updates only end date when start date is empty", () => {
    const onDateRangeChange = vi.fn();
    render(
      <MyServicesFiltersBar
        filters={baseFilters}
        onCategoryChange={vi.fn()}
        onCityChange={vi.fn()}
        onNeighborhoodChange={vi.fn()}
        onDateRangeChange={onDateRangeChange}
        onHasProposalsChange={vi.fn()}
        onHasImagesChange={vi.fn()}
        categoryOptions={[]}
        cityOptions={[]}
        neighborhoodOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    fireEvent.change(screen.getByLabelText(/Data final/i), {
      target: { value: "2025-06-01" },
    });
    expect(onDateRangeChange).toHaveBeenCalledWith(null, "2025-06-01");
  });

  it("desktop: clears end date while keeping start date", () => {
    const onDateRangeChange = vi.fn();
    render(
      <MyServicesFiltersBar
        filters={{ ...baseFilters, dateFrom: "2025-01-01", dateTo: "2025-01-31" }}
        onCategoryChange={vi.fn()}
        onCityChange={vi.fn()}
        onNeighborhoodChange={vi.fn()}
        onDateRangeChange={onDateRangeChange}
        onHasProposalsChange={vi.fn()}
        onHasImagesChange={vi.fn()}
        categoryOptions={[]}
        cityOptions={[]}
        neighborhoodOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    fireEvent.change(screen.getByLabelText(/Data final/i), { target: { value: "" } });
    expect(onDateRangeChange).toHaveBeenCalledWith("2025-01-01", null);
  });

  it("desktop: shows sem orçamentos and com fotos when filters are false and true", () => {
    render(
      <MyServicesFiltersBar
        filters={{ ...baseFilters, hasProposals: false, hasImages: true }}
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
    expect(
      (screen.getByLabelText(/Filtrar por existência de orçamentos/i) as HTMLSelectElement).value
    ).toBe("no");
    expect(
      (screen.getByLabelText(/Filtrar por existência de fotos/i) as HTMLSelectElement).value
    ).toBe("yes");
  });

  it("disables trigger when disabled prop is set", () => {
    render(
      <MyServicesFiltersBar
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
        disabled
      />
    );
    expect(screen.getByRole("button", { name: /Abrir filtros/i })).toBeDisabled();
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
      <MyServicesFiltersBar
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
      <MyServicesFiltersBar
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
      <MyServicesFiltersBar
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
