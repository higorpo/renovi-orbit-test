import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetCardSkeleton } from "../BudgetCardSkeleton";

describe("BudgetCardSkeleton", () => {
  it("renders card skeleton structure", () => {
    const { container } = render(<BudgetCardSkeleton />);
    expect(container.querySelector('[class*="rounded-lg"]')).toBeTruthy();
  });
});
