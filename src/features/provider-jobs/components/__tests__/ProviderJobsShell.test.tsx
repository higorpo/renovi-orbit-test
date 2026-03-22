import { render, screen } from "@testing-library/react";
import { Route, Routes, MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ProviderJobsShell, ProviderJobsRouteSlot } from "../ProviderJobsShell";

vi.mock("../ProviderJobsPage", () => ({
  ProviderJobsPage: () => <div data-testid="jobs-page" />,
}));

vi.mock("../JobDetailSheet", () => ({
  JobDetailSheet: () => <div data-testid="job-sheet" />,
}));

vi.mock("../JobDetailPage", () => ({
  JobDetailPage: () => <div data-testid="job-page" />,
}));

describe("ProviderJobsShell", () => {
  it("ProviderJobsRouteSlot renders nothing", () => {
    const { container } = render(<ProviderJobsRouteSlot />);
    expect(container.firstChild).toBeNull();
  });

  it("renders list and sheet when job opened from list state", () => {
    const job = { id: "j1", title: "T" };
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/dashboard/jobs/j1",
            state: { job, jobDetailPresentation: "sheet" as const },
          },
        ]}
      >
        <Routes>
          <Route path="/dashboard/jobs" element={<ProviderJobsShell />}>
            <Route path=":jobId" element={null} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("jobs-page")).toBeInTheDocument();
    expect(screen.getByTestId("job-sheet")).toBeInTheDocument();
  });

  it("renders full page when not sheet presentation", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/jobs/j1"]}>
        <Routes>
          <Route path="/dashboard/jobs" element={<ProviderJobsShell />}>
            <Route path=":jobId" element={null} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("job-page")).toBeInTheDocument();
  });
});
