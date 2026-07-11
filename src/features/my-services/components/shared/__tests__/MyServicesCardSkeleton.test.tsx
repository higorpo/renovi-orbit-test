// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MyServicesCardSkeleton } from "../MyServicesCardSkeleton";

describe("MyServicesCardSkeleton", () => {
  it("renders a card-shaped loading placeholder", () => {
    const { container } = render(<MyServicesCardSkeleton />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });
});
