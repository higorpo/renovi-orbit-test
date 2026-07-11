// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientServiceCardShowcasePage } from "../ClientServiceCardShowcasePage";
import { ProviderServiceCardShowcasePage } from "../../provider/ProviderServiceCardShowcasePage";

vi.mock("../ClientServiceListCard", () => ({
  ClientServiceListCard: ({ model }: { model: { id: string } }) => (
    <div data-testid={`client-card-${model.id}`} />
  ),
}));

vi.mock("../../provider/ProviderServiceListCard", () => ({
  ProviderServiceListCard: ({ model }: { model: { id: string } }) => (
    <div data-testid={`provider-card-${model.id}`} />
  ),
}));

describe("service card showcase pages", () => {
  it("renders grouped client showcase variants", () => {
    render(<ClientServiceCardShowcasePage />);

    expect(screen.getByText("Client Service Card — Showcase")).toBeTruthy();
    expect(screen.getByText("Negociação")).toBeTruthy();
    expect(screen.getByText("Em andamento")).toBeTruthy();
    expect(document.querySelectorAll('[data-testid^="client-card-"]').length).toBeGreaterThan(
      0,
    );
  });

  it("renders grouped provider showcase variants", () => {
    render(<ProviderServiceCardShowcasePage />);

    expect(screen.getByText("Provider Service Card — Showcase")).toBeTruthy();
    expect(screen.getByText("Negociação")).toBeTruthy();
    expect(screen.getByText("Concluídos")).toBeTruthy();
    expect(
      document.querySelectorAll('[data-testid^="provider-card-"]').length,
    ).toBeGreaterThan(0);
  });
});
