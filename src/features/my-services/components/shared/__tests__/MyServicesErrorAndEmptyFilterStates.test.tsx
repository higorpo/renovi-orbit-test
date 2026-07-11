// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MyServicesErrorState } from "../MyServicesErrorState";
import { MyServicesNoFilterResultsState } from "../MyServicesNoFilterResultsState";

describe("MyServicesErrorState", () => {
  it("renders error copy and retries on click", () => {
    const onRetry = vi.fn();
    render(<MyServicesErrorState onRetry={onRetry} />);

    expect(screen.getByText("Não foi possível carregar seus serviços")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("MyServicesNoFilterResultsState", () => {
  it("renders empty filter copy and clears filters", () => {
    const onClearFilters = vi.fn();
    render(<MyServicesNoFilterResultsState onClearFilters={onClearFilters} />);

    expect(screen.getByText("Nenhum serviço encontrado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });
});
