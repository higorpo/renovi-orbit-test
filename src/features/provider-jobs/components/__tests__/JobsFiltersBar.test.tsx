import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobsFiltersBar } from "../JobsFiltersBar";
import { DEFAULT_RADIUS_KM } from "../../constants/sortModes";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => true,
}));

describe("JobsFiltersBar (desktop)", () => {
  const baseFilters = {
    sortMode: "nearest" as const,
    radiusKm: DEFAULT_RADIUS_KM,
    serviceId: null as string | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("changes radius and service inside popover", () => {
    const onRadiusChange = vi.fn();
    const onServiceChange = vi.fn();
    render(
      <JobsFiltersBar
        filters={{ ...baseFilters, radiusKm: 5 }}
        onRadiusChange={onRadiusChange}
        onServiceChange={onServiceChange}
        onReset={vi.fn()}
        providerServices={[
          { id: "s1", title: "Limpeza", slug: "limpeza", icon_key: null, color_key: null },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /abrir filtros/i }));

    fireEvent.change(screen.getByLabelText(/raio de busca/i), {
      target: { value: "10" },
    });
    expect(onRadiusChange).toHaveBeenCalledWith(10);

    fireEvent.change(screen.getByLabelText(/filtrar por tipo de serviço/i), {
      target: { value: "s1" },
    });
    expect(onServiceChange).toHaveBeenCalledWith("s1");
  });

  it("calls onReset from popover header", () => {
    const onReset = vi.fn();
    render(
      <JobsFiltersBar
        filters={{ ...baseFilters, radiusKm: 20 }}
        onRadiusChange={vi.fn()}
        onServiceChange={vi.fn()}
        onReset={onReset}
        providerServices={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /abrir filtros/i }));
    fireEvent.click(screen.getByRole("button", { name: /^limpar$/i }));
    expect(onReset).toHaveBeenCalled();
  });
});
