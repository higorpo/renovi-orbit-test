import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobsEmptyState } from "../JobsEmptyState";
import { JobsErrorState } from "../JobsErrorState";
import { JobsHeader } from "../JobsHeader";
import { JobsSortTabs } from "../JobsSortTabs";
import { JobCardSkeleton } from "../JobCardSkeleton";
import { LocationPermissionBanner } from "../LocationPermissionBanner";

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
});
