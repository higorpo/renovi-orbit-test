import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetPreviewRow } from "../BudgetPreviewRow";
import type { BudgetPreviewItem } from "../../types/client-budgets.types";

vi.mock("@/features/provider-profile/hooks/usePublicProfileImageUrl", () => ({
  usePublicProfileImageUrl: () => ({ url: null }),
}));

vi.mock("@/lib/formatRelativeDate", () => ({
  formatRelativeDate: () => "ontem",
}));

const budgetBase: BudgetPreviewItem = {
  id: "b1",
  provider_id: "p1",
  provider_name: "Ana Silva",
  provider_slug: "ana",
  provider_profile_image_path: null,
  proposed_amount: 100,
  status: "submitted",
  created_at: "2024-01-01T00:00:00Z",
};

describe("BudgetPreviewRow", () => {
  it("uses P fallback initial when provider name is empty", () => {
    render(<BudgetPreviewRow budget={{ ...budgetBase, provider_name: "   " }} />);
    expect(screen.getByText("P")).toBeInTheDocument();
  });
});
