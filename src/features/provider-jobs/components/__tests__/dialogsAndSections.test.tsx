import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";
import { JobDetailFloatingActions } from "../JobDetailFloatingActions";
import { JobDetailMetadataBadges } from "../JobDetailMetadataBadges";
import { JobDetailRequestSections } from "../JobDetailRequestSections";
import { JobDetailSkeleton } from "../JobDetailSkeleton";
import { mapSuggestedEquipmentToPt, mapSuggestedMaterialsToPt } from "../../utils/suggestedItemsMapper";

vi.mock("@/features/request-quote", () => ({
  useServiceRequestPhotoUrls: () => ({
    urls: ["https://photo.test/1.jpg"],
    isLoading: false,
  }),
}));

const mockProposalPhotoUrls = vi.fn();
vi.mock("@/features/negotiation-proposals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/negotiation-proposals")>();
  return {
    ...actual,
    useProposalPhotoUrls: () => mockProposalPhotoUrls(),
  };
});

describe("JobDetail sections", () => {
  it("renders JobDetailSkeleton", () => {
    render(<JobDetailSkeleton />);
    expect(screen.getByLabelText(/carregando detalhes/i)).toBeInTheDocument();
  });

  it("renders JobDetailMetadataBadges when hints exist", () => {
    const job = createMinimalJob({
      estimated_duration_hint: "1_day",
      scope_complexity: "medium",
    });
    render(<JobDetailMetadataBadges job={job} />);
    expect(screen.getByText(/1 dia/i)).toBeInTheDocument();
    expect(screen.getByText(/complexidade/i)).toBeInTheDocument();
  });

  it("renders JobDetailMetadataBadges empty when no metadata", () => {
    const job = createMinimalJob({
      estimated_duration_hint: null,
      scope_complexity: null,
    });
    const { container } = render(<JobDetailMetadataBadges job={job} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders JobDetailRequestSections with gallery and tags", () => {
    const job = createMinimalJob({
      photos: ["a.jpg", "b.jpg"],
      tags: ["tag1"],
    });
    const eq = mapSuggestedEquipmentToPt(job.suggested_equipment);
    const mat = mapSuggestedMaterialsToPt(job.suggested_materials);
    render(<JobDetailRequestSections job={job} suggestedEquipmentPt={eq} suggestedMaterialsPt={mat} />);
    expect(screen.getByText(/descrição/i)).toBeInTheDocument();
    expect(screen.getByText(/fotos \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText("tag1")).toBeInTheDocument();
  });

  it("renders JobDetailFloatingActions and fires proposal callback", () => {
    const onProposal = vi.fn();
    render(
      <JobDetailFloatingActions
        isInsideSheet
        onOpenProposalComposer={onProposal}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /fazer orçamento/i }));
    expect(onProposal).toHaveBeenCalled();
  });
});
