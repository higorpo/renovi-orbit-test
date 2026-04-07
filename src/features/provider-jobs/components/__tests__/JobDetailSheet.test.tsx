import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});
import { JobDetailSheet } from "../JobDetailSheet";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";

const mockDetail = vi.fn();
vi.mock("../../hooks/useProviderJobDetail", () => ({
  useProviderJobDetail: (...args: unknown[]) => mockDetail(...args),
}));

vi.mock("../JobDetailContent", () => ({
  JobDetailContent: () => <div data-testid="sheet-content">loaded</div>,
}));

vi.mock("../JobDetailSkeleton", () => ({
  JobDetailSkeleton: () => <div data-testid="sheet-skeleton">loading</div>,
}));

vi.mock("../JobDetailStates", () => ({
  JobDetailNotFound: () => <div data-testid="sheet-not-found">missing</div>,
}));

describe("JobDetailSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows content when job is loaded", () => {
    const job = createMinimalJob();
    mockDetail.mockReturnValue({
      job,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <MemoryRouter>
        <JobDetailSheet jobId="job-1" initialJob={job} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("sheet-content")).toBeInTheDocument();
  });

  it("shows skeleton while job is loading", () => {
    mockDetail.mockReturnValue({
      job: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <MemoryRouter>
        <JobDetailSheet jobId="job-1" initialJob={null} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("sheet-skeleton")).toBeInTheDocument();
  });

  it("shows not found when job is missing after load", () => {
    mockDetail.mockReturnValue({
      job: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <MemoryRouter>
        <JobDetailSheet jobId="job-1" initialJob={null} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("sheet-not-found")).toBeInTheDocument();
  });

  it("navigates back when sheet requests close", () => {
    const job = createMinimalJob();
    mockDetail.mockReturnValue({
      job,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <MemoryRouter>
        <JobDetailSheet jobId="job-1" initialJob={job} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^fechar$/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
