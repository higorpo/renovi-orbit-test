import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrestwayIcon } from "../PrestwayIcon";

describe("PrestwayIcon", () => {
  it("renders five paths with the client palette by default", () => {
    const { container } = render(<PrestwayIcon data-testid="icon" />);
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(5);
    expect(paths[0]).toHaveAttribute("fill", "#2D89F0");
    expect(paths[1]).toHaveAttribute("fill", "#2563EB");
    expect(paths[4]).toHaveAttribute("fill", "#93C5FD");
    expect(container.querySelector("svg")).toHaveAttribute(
      "viewBox",
      "0 0 119 139"
    );
  });

  it.each([
    ["provider", "#FA8432", "#F97316", "#FDBA74"],
    ["inst", "#FA8432", "#2563EB", "#FDBA74"],
    ["white", "white", "white", "white"],
    ["dark", "black", "black", "black"],
  ] as const)(
    "applies the %s palette",
    (variant, first, second, last) => {
      const { container } = render(<PrestwayIcon variant={variant} />);
      const paths = container.querySelectorAll("path");
      expect(paths[0]).toHaveAttribute("fill", first);
      expect(paths[1]).toHaveAttribute("fill", second);
      expect(paths[4]).toHaveAttribute("fill", last);
    }
  );

  it("renders the full lockup with mark + wordmark", () => {
    const { container } = render(
      <PrestwayIcon variant="inst" layout="full" />
    );
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(13);
    expect(container.querySelector("svg")).toHaveAttribute(
      "viewBox",
      "0 0 294 81"
    );
    expect(paths[0]).toHaveAttribute("fill", "#FA8432");
    expect(paths[5]).toHaveAttribute("fill", "black");
  });

  it("renders wordmark-only with the cropped viewBox", () => {
    const { container } = render(
      <PrestwayIcon layout="wordmark" variant="dark" />
    );
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(8);
    expect(container.querySelector("svg")).toHaveAttribute(
      "viewBox",
      "92.7 24.3 200.7 39.3"
    );
    expect(paths[0]).toHaveAttribute("fill", "black");
  });

  it("uses a white wordmark when variant is white or wordmarkTone is white", () => {
    const whiteVariant = render(
      <PrestwayIcon layout="full" variant="white" />
    );
    expect(
      whiteVariant.container.querySelectorAll("path")[5]
    ).toHaveAttribute("fill", "white");

    const toneOverride = render(
      <PrestwayIcon layout="full" variant="inst" wordmarkTone="white" />
    );
    expect(
      toneOverride.container.querySelectorAll("path")[5]
    ).toHaveAttribute("fill", "white");
    expect(
      toneOverride.container.querySelectorAll("path")[0]
    ).toHaveAttribute("fill", "#FA8432");
  });

  it("is decorative by default", () => {
    const { container } = render(<PrestwayIcon />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes an accessible name when aria-label is set", () => {
    render(<PrestwayIcon aria-label="Prestway" />);
    expect(screen.getByLabelText("Prestway")).toBeInTheDocument();
  });
});
