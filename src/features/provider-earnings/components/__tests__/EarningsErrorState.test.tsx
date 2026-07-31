import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EarningsErrorState } from "../EarningsErrorState";

describe("EarningsErrorState", () => {
  it("renders error copy and retries on action", () => {
    const onRetry = vi.fn();
    render(<EarningsErrorState onRetry={onRetry} />);

    expect(screen.getByText("Erro ao carregar ganhos")).toBeInTheDocument();
    expect(
      screen.getByText(/Não foi possível carregar suas liquidações/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
