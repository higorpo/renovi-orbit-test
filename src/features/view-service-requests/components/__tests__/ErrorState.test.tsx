import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorState } from "../ErrorState";

describe("ErrorState", () => {
  it("renders message and retry button", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(
      screen.getByRole("heading", {
        name: /Não foi possível carregar seus serviços/i,
      })
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /Tentar novamente/i });
    expect(button).toBeInTheDocument();
  });

  it("calls onRetry when button is clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    const button = screen.getByRole("button", { name: /Tentar novamente/i });
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
