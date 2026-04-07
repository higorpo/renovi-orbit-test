import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetPreviewRow } from "../BudgetPreviewRow";
import { QuestionPreviewRow } from "../QuestionPreviewRow";
import type { BudgetPreviewItem, QuestionPreviewItem } from "../../types/client-budgets.types";

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

const questionBase: QuestionPreviewItem = {
  id: "q1",
  provider_id: "p1",
  provider_name: "Bob",
  provider_slug: "bob",
  provider_profile_image_path: null,
  question: "Dúvida?",
  client_response: null,
  client_response_images: [],
  created_at: "2024-01-02T00:00:00Z",
  client_responded_at: null,
};

describe("BudgetPreviewRow", () => {
  it("uses P fallback initial when provider name is empty", () => {
    render(<BudgetPreviewRow budget={{ ...budgetBase, provider_name: "   " }} />);
    expect(screen.getByText("P")).toBeInTheDocument();
  });
});

describe("QuestionPreviewRow", () => {
  it("uses P fallback initial when provider name is whitespace-only", () => {
    render(<QuestionPreviewRow question={{ ...questionBase, provider_name: "" }} />);
    expect(screen.getByText("P")).toBeInTheDocument();
  });
});
