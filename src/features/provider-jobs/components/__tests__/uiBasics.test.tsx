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
    const onClear = vi.fn();
    const { rerender } = render(
      <JobsEmptyState hasFilters onClearFilters={onClear} />,
    );
    expect(screen.getByText(/nenhum trabalho encontrado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /limpar filtros/i }));
    expect(onClear).toHaveBeenCalled();
    rerender(<JobsEmptyState hasFilters={false} />);
    expect(screen.getByText(/nenhuma oportunidade na sua região/i)).toBeInTheDocument();
  });

  it("renders JobsHeader with feed GPS warning when using default location", () => {
    render(<JobsHeader isUsingDefaultLocation />);
    expect(screen.getByText(/sem gps do feed/i)).toBeInTheDocument();
  });

  it("hides GPS warning when not using default location", () => {
    render(<JobsHeader isUsingDefaultLocation={false} />);
    expect(screen.queryByText(/sem gps do feed/i)).not.toBeInTheDocument();
  });

  it("renders JobsSortTabs and notifies mode change", () => {
    const onModeChange = vi.fn();
    render(
      <JobsSortTabs
        activeMode="newest"
        onModeChange={onModeChange}
        hasFeedGps
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /mais próximos/i }));
    expect(onModeChange).toHaveBeenCalledWith("nearest");
    onModeChange.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: /menos concorridos/i }));
    expect(onModeChange).toHaveBeenCalledWith("least_competitive");
  });

  it("hides nearest sort tab without feed GPS", () => {
    render(
      <JobsSortTabs activeMode="newest" onModeChange={vi.fn()} hasFeedGps={false} />,
    );
    expect(screen.queryByRole("tab", { name: /mais próximos/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /mais recentes/i })).toBeInTheDocument();
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
      <LocationPermissionBanner
        permissionDenied
        isNativeApp
        insecureContext={false}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(/localização bloqueada no app/i)).toBeInTheDocument();
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
