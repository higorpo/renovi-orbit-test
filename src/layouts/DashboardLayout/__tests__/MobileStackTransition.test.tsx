import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { MobileStackTransition } from "../MobileStackTransition";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { useReducedMotion } from "framer-motion";

const useReducedMotionMock = vi.mocked(useReducedMotion);

describe("MobileStackTransition", () => {
  it("renders children without motion wrapper when reduced motion is preferred", () => {
    useReducedMotionMock.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={["/dashboard/a"]}>
        <MobileStackTransition>
          <p>Stack content</p>
        </MobileStackTransition>
      </MemoryRouter>,
    );

    expect(screen.getByText("Stack content")).toBeInTheDocument();
  });

  it("renders animated stack content when motion is allowed", () => {
    useReducedMotionMock.mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/dashboard/a"]}>
        <MobileStackTransition className="extra">
          <p>Animated content</p>
        </MobileStackTransition>
      </MemoryRouter>,
    );

    expect(screen.getByText("Animated content")).toBeInTheDocument();
  });
});
