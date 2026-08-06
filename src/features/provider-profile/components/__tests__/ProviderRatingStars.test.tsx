import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProviderRatingStars } from "../ProviderRatingStars";

describe("ProviderRatingStars", () => {
  it("renders five stars", () => {
    const { container } = render(<ProviderRatingStars rating={4.5} />);
    expect(container.querySelectorAll("svg")).toHaveLength(5);
  });
});
