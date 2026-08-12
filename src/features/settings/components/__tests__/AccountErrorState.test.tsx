import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AccountErrorState } from "../AccountErrorState";

vi.mock("@/components/ui/error-state", () => ({
  ErrorState: ({
    title,
    description,
    onRetry,
  }: {
    title: string;
    description: string;
    onRetry?: () => void;
  }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      ) : null}
    </div>
  ),
}));

describe("AccountErrorState", () => {
  it("renders title and description from ErrorState contract", () => {
    render(<AccountErrorState />);
    expect(screen.getByText("Não foi possível carregar sua conta")).toBeInTheDocument();
    expect(
      screen.getByText(/Ocorreu um erro ao buscar seus dados/)
    ).toBeInTheDocument();
  });

  it("passes onRetry to ErrorState when provided", () => {
    const onRetry = vi.fn();
    render(<AccountErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
