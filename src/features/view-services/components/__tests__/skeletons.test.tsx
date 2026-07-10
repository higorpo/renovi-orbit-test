// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceDetailSkeleton } from "../ServiceDetailSkeleton";
import { SimpleServiceCardSkeleton } from "../SimpleServiceCardSkeleton";

describe("skeletons", () => {
  it("renders service detail skeleton with busy label", () => {
    render(<ServiceDetailSkeleton />);
    expect(
      screen.getByLabelText("Carregando detalhes do serviço"),
    ).toBeInTheDocument();
  });

  it("renders compact and default card skeletons", () => {
    const { rerender } = render(<SimpleServiceCardSkeleton />);
    expect(document.querySelector(".shadow-none")).toBeTruthy();
    rerender(<SimpleServiceCardSkeleton compact />);
    expect(document.querySelector(".shadow-none")).toBeTruthy();
  });
});
