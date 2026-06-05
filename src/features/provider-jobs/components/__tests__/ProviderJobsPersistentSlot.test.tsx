import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ProviderJobsPersistentSlot } from "../ProviderJobsPersistentSlot";

vi.mock("../ProviderJobsPage", () => ({
  ProviderJobsPage: () => <div data-testid="jobs-page" />,
}));

describe("ProviderJobsPersistentSlot", () => {
  it("renders jobs page on /dashboard/jobs", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/jobs"]}>
        <Routes>
          <Route path="/dashboard/jobs" element={<ProviderJobsPersistentSlot />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("jobs-page")).toBeInTheDocument();
  });

  it("keeps jobs page mounted when service detail sheet is open from jobs", () => {
    render(
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
          <Route path="/dashboard/services/:id" element={<ProviderJobsPersistentSlot />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("jobs-page")).toBeInTheDocument();
  });

  it("renders nothing on unrelated routes", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard/requests"]}>
        <Routes>
          <Route path="/dashboard/requests" element={<ProviderJobsPersistentSlot />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
