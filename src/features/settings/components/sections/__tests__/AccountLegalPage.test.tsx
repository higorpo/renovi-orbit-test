import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountLegalPage } from "../AccountLegalPage";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));

describe("AccountLegalPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides the provider contract for clients", () => {
    useAuth.mockReturnValue({
      profile: { role: "client" },
    } as unknown as ReturnType<typeof useAuth>);

    render(<AccountLegalPage />);

    expect(screen.getByRole("heading", { name: "Jurídico" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Termos de uso" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Contrato de uso da plataforma" }),
    ).not.toBeInTheDocument();
  });

  it("shows the provider contract for providers", () => {
    useAuth.mockReturnValue({
      profile: { role: "provider" },
    } as unknown as ReturnType<typeof useAuth>);

    render(<AccountLegalPage />);

    expect(
      screen.getByRole("heading", { name: "Contrato de uso da plataforma" }),
    ).toBeInTheDocument();
  });
});
