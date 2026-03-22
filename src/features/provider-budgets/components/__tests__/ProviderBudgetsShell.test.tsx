import { render, screen } from "@testing-library/react";
import { Route, Routes, MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  ProviderBudgetsShell,
  ProviderBudgetsRouteSlot,
} from "../ProviderBudgetsShell";

const shellMocks = vi.hoisted(() => ({
  JobDetailSheet: vi.fn(
    (props: { jobId: string; initialJob: unknown | null }) => (
      <div
        data-testid="job-sheet"
        data-has-initial-job={props.initialJob != null ? "1" : "0"}
      >
        {props.jobId}
      </div>
    ),
  ),
}));

vi.mock("../ProviderBudgetsPage", () => ({
  ProviderBudgetsPage: () => <div data-testid="budgets-page" />,
}));

vi.mock("@/features/provider-jobs/components/JobDetailSheet", () => ({
  JobDetailSheet: shellMocks.JobDetailSheet,
}));

vi.mock("@/features/provider-jobs/components/JobDetailPage", () => ({
  JobDetailPage: ({ jobId }: { jobId: string }) => (
    <div data-testid="job-page">{jobId}</div>
  ),
}));

describe("ProviderBudgetsShell", () => {
  it("ProviderBudgetsRouteSlot renders nothing", () => {
    const { container } = render(<ProviderBudgetsRouteSlot />);
    expect(container.firstChild).toBeNull();
  });

  it("renders list and sheet when detail opened as sheet", () => {
    const job = { id: "sr-1", title: "T" };
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/dashboard/budgets/pedido/sr-1",
            state: { job, jobDetailPresentation: "sheet" as const },
          },
        ]}
      >
        <Routes>
          <Route path="/dashboard/budgets" element={<ProviderBudgetsShell />}>
            <Route path="pedido/:serviceRequestId" element={null} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("budgets-page")).toBeInTheDocument();
    expect(screen.getByTestId("job-sheet")).toHaveTextContent("sr-1");
    expect(screen.getByTestId("job-sheet")).toHaveAttribute("data-has-initial-job", "1");
  });

  it("passes null initial job when sheet state omits job payload", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/dashboard/budgets/pedido/sr-55",
            state: { jobDetailPresentation: "sheet" as const },
          },
        ]}
      >
        <Routes>
          <Route path="/dashboard/budgets" element={<ProviderBudgetsShell />}>
            <Route path="pedido/:serviceRequestId" element={null} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("job-sheet")).toHaveAttribute("data-has-initial-job", "0");
  });

  it("renders full page when not sheet presentation", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/budgets/pedido/sr-99"]}>
        <Routes>
          <Route path="/dashboard/budgets" element={<ProviderBudgetsShell />}>
            <Route path="pedido/:serviceRequestId" element={null} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("job-page")).toHaveTextContent("sr-99");
    expect(screen.queryByTestId("budgets-page")).not.toBeInTheDocument();
  });

  it("renders only list when no service request in path", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/budgets"]}>
        <Routes>
          <Route path="/dashboard/budgets" element={<ProviderBudgetsShell />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("budgets-page")).toBeInTheDocument();
    expect(screen.queryByTestId("job-sheet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("job-page")).not.toBeInTheDocument();
  });
});
