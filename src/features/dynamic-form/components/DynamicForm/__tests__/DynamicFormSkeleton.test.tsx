import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DynamicFormSkeleton } from "../DynamicFormSkeleton";

describe("DynamicFormSkeleton", () => {
  it("renders pulse layout regions", () => {
    const { container } = render(<DynamicFormSkeleton />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-muted").length).toBeGreaterThan(3);
  });
});
