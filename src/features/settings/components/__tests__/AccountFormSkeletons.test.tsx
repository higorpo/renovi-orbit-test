import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ClientFormSkeleton, ProviderFormSkeleton } from "../AccountFormSkeletons";

describe("AccountFormSkeletons", () => {
  it("renders ClientFormSkeleton with skeleton placeholders", () => {
    const { container } = render(<ClientFormSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders ProviderFormSkeleton with more placeholders than client skeleton", () => {
    const { container: clientC } = render(<ClientFormSkeleton />);
    const { container: providerC } = render(<ProviderFormSkeleton />);
    expect(providerC.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      clientC.querySelectorAll(".animate-pulse").length
    );
  });
});
