// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ServiceDetailNarrowStack,
  ServiceDetailWideLayout,
} from "../ServiceDetailLayout";

describe("ServiceDetailLayout", () => {
  it("renders a single-column stack", () => {
    render(
      <ServiceDetailNarrowStack>
        <span>narrow</span>
      </ServiceDetailNarrowStack>,
    );
    expect(screen.getByText("narrow")).toBeInTheDocument();
  });

  it("scopes sticky aside to the columns row above support", () => {
    const { container } = render(
      <ServiceDetailWideLayout
        alerts={<span>alerts</span>}
        main={<span>main</span>}
        aside={<span>aside</span>}
        support={<span>support</span>}
      />,
    );

    const root = container.firstElementChild;
    const columnsRow = root?.children[1];
    expect(columnsRow).toHaveClass("grid", "grid-cols-1");
    expect(columnsRow?.className).toContain(
      "has-[aside:not(:empty)]:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]",
    );

    const aside = columnsRow?.querySelector("aside");
    expect(aside).toHaveClass("sticky", "top-4", "self-start", "empty:hidden");
    expect(aside).toHaveTextContent("aside");
    expect(root?.lastElementChild).toHaveTextContent("support");
    expect(root?.lastElementChild?.contains(aside!)).toBe(false);
  });

  it("leaves the columns row as a single track when aside has no DOM children", () => {
    const { container } = render(
      <ServiceDetailWideLayout
        main={<span>main</span>}
        aside={[null, null, false]}
        support={<span>support</span>}
      />,
    );

    const columnsRow = container.firstElementChild?.children[0];
    const aside = columnsRow?.querySelector("aside");
    expect(aside).toBeTruthy();
    expect(aside?.childNodes.length).toBe(0);
    expect(aside).toBeEmptyDOMElement();
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("omits the aside element when aside prop is omitted", () => {
    const { container } = render(
      <ServiceDetailWideLayout main={<span>main-only</span>} />,
    );

    expect(container.querySelector("aside")).toBeNull();
    expect(screen.getByText("main-only")).toBeInTheDocument();
  });
});
