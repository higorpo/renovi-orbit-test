import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileStackHeader } from "../MobileStackHeader";
import { MobileStackTransition } from "../MobileStackTransition";

const handleBackMock = vi.fn();
const useReducedMotionMock = vi.fn(() => false);

vi.mock("../useMobileBackNavigation", () => ({
  useMobileBackNavigation: () => handleBackMock,
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => useReducedMotionMock(),
  };
});

describe("MobileStackHeader", () => {
  beforeEach(() => {
    handleBackMock.mockClear();
  });

  it("renders the title and delegates back to the navigation hook", () => {
    render(
      <MemoryRouter>
        <MobileStackHeader title="Detalhe" backFallback="/dashboard/services" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("mobile-stack-header")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Detalhe" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(handleBackMock).toHaveBeenCalledOnce();
  });

  it("offsets below the offline banner when offline", () => {
    render(
      <MemoryRouter>
        <MobileStackHeader title="Offline" isOffline />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("mobile-stack-header").className).toContain("top-11");
  });
});

function TransitionProbe() {
  const navigate = useNavigate();
  return (
    <MobileStackTransition>
      <button type="button" onClick={() => navigate("/dashboard/b")}>
        Go forward
      </button>
      <button type="button" onClick={() => navigate("/dashboard/a")}>
        Go back
      </button>
      <p>content</p>
    </MobileStackTransition>
  );
}

describe("MobileStackTransition", () => {
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false);
  });

  it("renders children without motion when reduced motion is preferred", () => {
    useReducedMotionMock.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/dashboard/a"]}>
        <Routes>
          <Route path="*" element={<TransitionProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("keeps children mounted while navigating stack routes", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/a"]}>
        <Routes>
          <Route path="*" element={<TransitionProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Go forward" }));
    expect(screen.getAllByText("content").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Go back" })[0]);
    expect(screen.getAllByText("content").length).toBeGreaterThan(0);
  });
});
