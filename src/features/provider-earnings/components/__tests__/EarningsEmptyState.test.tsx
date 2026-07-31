import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EarningsEmptyState } from "../EarningsEmptyState";

describe("EarningsEmptyState", () => {
  it("shows default empty copy when no filters are active", () => {
    render(<EarningsEmptyState hasFilters={false} />);

    expect(screen.getByRole("status", { name: /Nenhuma liquidação/i })).toBeInTheDocument();
    expect(screen.getByText("Nenhuma liquidação ainda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Limpar filtros/i })).not.toBeInTheDocument();
  });

  it("shows filtered empty copy and clear action", () => {
    const onClearFilters = vi.fn();
    render(<EarningsEmptyState hasFilters onClearFilters={onClearFilters} />);

    expect(
      screen.getByRole("status", { name: /Nenhuma liquidação com os filtros aplicados/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhuma liquidação neste filtro")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/i }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
