import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { JobCard } from "../JobCard";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: () => ({
    color: "from-slate-600 to-slate-800",
    Icon: () => <span data-testid="svc-icon" />,
  }),
  useServiceRequestPhotoUrls: () => ({ urls: ["https://img.test/a.jpg"], isLoading: false }),
}));

describe("JobCard", () => {
  it("renders job metadata and links to detail", () => {
    const job = createMinimalJob({
      title: "Troca de chuveiro",
      urgency: "high",
      photos: ["p1.jpg"],
    });
    render(
      <MemoryRouter>
        <JobCard job={job} />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Troca de chuveiro").length).toBeGreaterThan(0);
    expect(screen.getByText(/urgente/i)).toBeInTheDocument();
    expect(screen.getByText(/sua área/i)).toBeInTheDocument();
    const mainLink = screen.getByRole("link", { name: /ver detalhes: troca de chuveiro/i });
    expect(mainLink).toHaveAttribute("href", "/dashboard/services/job-1");
  });

  it("renders footer link to job detail", () => {
    const job = createMinimalJob({ photos: null });
    render(
      <MemoryRouter>
        <JobCard job={job} />
      </MemoryRouter>,
    );
    const footerLink = screen.getByRole("link", { name: /^ver detalhes$/i });
    expect(footerLink).toHaveAttribute("href", "/dashboard/services/job-1");
  });
});
