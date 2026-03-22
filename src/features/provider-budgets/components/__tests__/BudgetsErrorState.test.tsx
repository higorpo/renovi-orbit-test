import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetsErrorState } from "../BudgetsErrorState";

describe("BudgetsErrorState", () => {
  it("invokes onRetry when clicking retry", () => {
    const onRetry = vi.fn();
    render(<BudgetsErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
