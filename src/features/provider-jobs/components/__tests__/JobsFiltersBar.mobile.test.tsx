import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobsFiltersBar } from "../JobsFiltersBar";
import { DEFAULT_RADIUS_KM } from "../../constants/sortModes";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => false,
}));

describe("JobsFiltersBar (mobile sheet)", () => {
  const baseFilters = {
    sortMode: "nearest" as const,
    radiusKm: DEFAULT_RADIUS_KM,
    serviceId: null as string | null,
  };

  it("opens sheet and applies filters footer", () => {
    const onRadiusChange = vi.fn();
    render(
      <JobsFiltersBar
        filters={baseFilters}
        onRadiusChange={onRadiusChange}
        onServiceChange={vi.fn()}
        onReset={vi.fn()}
        providerServices={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /abrir filtros/i }));
    fireEvent.change(screen.getByLabelText(/raio de busca/i), {
      target: { value: "5" },
    });
    expect(onRadiusChange).toHaveBeenCalledWith(5);
    fireEvent.click(screen.getByRole("button", { name: /aplicar filtros/i }));
  });
});
