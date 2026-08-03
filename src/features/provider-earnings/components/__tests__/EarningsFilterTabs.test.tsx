import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EarningsFilterTabs } from "../EarningsFilterTabs";

describe("EarningsFilterTabs", () => {
  it("renders settlement filter tabs and notifies on change", () => {
    const onFilterChange = vi.fn();
    render(
      <EarningsFilterTabs activeFilter="all" onFilterChange={onFilterChange} />,
    );

    expect(screen.getByRole("tablist", { name: /Filtros de ganhos/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Todos" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "Previsto" }));
    expect(onFilterChange).toHaveBeenCalledWith("pending");
  });

  it("disables tabs while loading", () => {
    render(
      <EarningsFilterTabs
        activeFilter="paid_out"
        onFilterChange={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole("tab", { name: "Liquidado" })).toBeDisabled();
    expect(screen.queryByRole("tab", { name: "Estorno" })).not.toBeInTheDocument();
  });
});
