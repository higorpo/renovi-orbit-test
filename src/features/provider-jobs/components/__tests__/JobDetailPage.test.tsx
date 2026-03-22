import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobDetailPage } from "../JobDetailPage";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";

const mockDetail = vi.fn();
vi.mock("../../hooks/useProviderJobDetail", () => ({
  useProviderJobDetail: (...args: unknown[]) => mockDetail(...args),
}));

vi.mock("../JobDetailContent", () => ({
  JobDetailContent: ({ job }: { job: { title: string } }) => (
    <div data-testid="detail-content">{job.title}</div>
  ),
}));

describe("JobDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeleton while loading", () => {
    mockDetail.mockReturnValue({
      job: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <MemoryRouter>
        <JobDetailPage jobId="job-1" />
      </MemoryRouter>,
    );
    expect(
      screen.getByLabelText(/carregando detalhes do trabalho/i),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("shows error with retry", () => {
    const refetch = vi.fn();
    mockDetail.mockReturnValue({
      job: null,
      isLoading: false,
      isError: true,
      refetch,
    });
    render(
      <MemoryRouter>
        <JobDetailPage jobId="job-1" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders content when job loaded", () => {
    const job = createMinimalJob();
    mockDetail.mockReturnValue({
      job,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <MemoryRouter>
        <JobDetailPage jobId="job-1" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("detail-content")).toHaveTextContent(job.title);
  });

  it("shows not found when job missing", () => {
    mockDetail.mockReturnValue({
      job: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <MemoryRouter>
        <JobDetailPage jobId="job-1" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/trabalho não encontrado/i)).toBeInTheDocument();
  });
});
