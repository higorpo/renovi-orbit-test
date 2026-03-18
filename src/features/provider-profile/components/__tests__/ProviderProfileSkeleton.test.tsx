import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProviderProfileSkeleton } from "../ProviderProfileSkeleton";

describe("ProviderProfileSkeleton", () => {
  it("renders skeleton elements", () => {
    const { container } = render(<ProviderProfileSkeleton />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(5);
  });

  it("renders rounded-full skeleton for avatar", () => {
    const { container } = render(<ProviderProfileSkeleton />);
    const avatarSkeleton = container.querySelector(".rounded-full.animate-pulse");
    expect(avatarSkeleton).toBeTruthy();
  });

  it("renders grid skeletons for services section", () => {
    const { container } = render(<ProviderProfileSkeleton />);
    const grids = container.querySelectorAll(".grid");
    expect(grids.length).toBeGreaterThanOrEqual(2);
  });
});
