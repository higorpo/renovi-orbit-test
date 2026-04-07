import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { FormResponsesSummary } from "../FormResponsesSummary";
import { JobsEmptyState } from "../JobsEmptyState";
import { JobsErrorState } from "../JobsErrorState";
import { JobsHeader } from "../JobsHeader";
import { JobsSortTabs } from "../JobsSortTabs";
import { JobCardSkeleton } from "../JobCardSkeleton";
import { JobDetailBackLink, JobDetailNotFound } from "../JobDetailStates";
import { LocationPermissionBanner } from "../LocationPermissionBanner";
import { SuggestedItemsInfo } from "../SuggestedItemsInfo";

vi.mock("@/features/dynamic-form", () => ({
  buildSummaryEntries: vi.fn(() => [
    { id: "a", label: "Campo", displayValue: "Valor" },
  ]),
}));

describe("presentational components", () => {
  it("renders JobsErrorState and calls onRetry", () => {
    const onRetry = vi.fn();
    render(<JobsErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders JobsEmptyState with and without filters", () => {
    const { rerender } = render(
      <JobsEmptyState hasFilters onClearFilters={vi.fn()} />,
    );
    expect(screen.getByText(/nenhum trabalho encontrado/i)).toBeInTheDocument();
    rerender(<JobsEmptyState hasFilters={false} />);
    expect(screen.getByText(/nenhuma oportunidade na sua região/i)).toBeInTheDocument();
  });

  it("renders JobsHeader with area summary and count pluralization", () => {
    render(
      <JobsHeader
        totalCount={1}
        isLoading={false}
        isUsingDefaultLocation
        providerAreaSummary={{
          cities: ["A", "B"],
          neighborhoods: ["N1", "N2", "N3", "N4"],
        }}
      />,
    );
    expect(screen.getByText(/1 trabalho encontrado/i)).toBeInTheDocument();
    expect(screen.getByText(/localização aproximada/i)).toBeInTheDocument();
  });

  it("renders JobsSortTabs and notifies mode change", () => {
    const onModeChange = vi.fn();
    render(
      <JobsSortTabs activeMode="nearest" onModeChange={onModeChange} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /mais recentes/i }));
    expect(onModeChange).toHaveBeenCalledWith("newest");
    onModeChange.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: /mais próximos/i }));
    expect(onModeChange).toHaveBeenCalledWith("nearest");
  });

  it("renders LocationPermissionBanner variants", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <LocationPermissionBanner permissionDenied insecureContext onRetry={onRetry} />,
    );
    expect(screen.getByText(/conexão sem https/i)).toBeInTheDocument();
    rerender(
      <LocationPermissionBanner
        permissionDenied
        insecureContext={false}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(/localização bloqueada no navegador/i)).toBeInTheDocument();
    rerender(
      <LocationPermissionBanner permissionDenied={false} onRetry={onRetry} />,
    );
    expect(screen.getByText(/localização aproximada/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders JobCardSkeleton", () => {
    const { container } = render(<JobCardSkeleton />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders SuggestedItemsInfo trigger", () => {
    render(<SuggestedItemsInfo ariaLabel="Ajuda sugeridos" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajuda sugeridos" }));
    expect(screen.getByText(/itens sugeridos com base/i)).toBeInTheDocument();
  });

  it("renders FormResponsesSummary when entries exist", () => {
    render(<FormResponsesSummary formData={{}} formSchema={null} />);
    expect(screen.getByText("Informações do pedido")).toBeInTheDocument();
    expect(screen.getByText("Valor")).toBeInTheDocument();
  });

  it("renders job detail navigation states", () => {
    render(
      <MemoryRouter>
        <JobDetailBackLink />
        <JobDetailNotFound />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: /voltar para trabalhos/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/trabalho não encontrado/i)).toBeInTheDocument();
  });
});
