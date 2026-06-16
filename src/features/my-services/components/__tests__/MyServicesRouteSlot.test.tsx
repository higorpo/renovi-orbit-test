import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { MyServicesRouteSlot } from "../MyServicesRouteSlot";

describe("MyServicesRouteSlot", () => {
  it("renders nothing; lists live in persistent slots", () => {
    const { container } = render(
      <MemoryRouter>
        <MyServicesRouteSlot />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
