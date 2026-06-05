import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ServiceDetailShell } from "../ServiceDetailShell";

vi.mock("../ServiceDetailPage", () => ({
  ServiceDetailPage: () => <div data-testid="service-page" />,
}));

describe("ServiceDetailShell", () => {
  it("renders nothing when opened as sheet with background location", () => {
    const { container } = render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/dashboard/services/sr-1",
            state: {
              serviceDetailPresentation: "sheet",
              returnTo: "/dashboard/jobs",
              background: { pathname: "/dashboard/jobs", search: "", hash: "", key: "bg" },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/dashboard/services/:id" element={<ServiceDetailShell />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders full page when not opened as sheet", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/services/sr-1"]}>
        <Routes>
          <Route path="/dashboard/services/:id" element={<ServiceDetailShell />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("service-page")).toBeInTheDocument();
  });
});
