import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { MyServicesRouteSlot } from "../MyServicesRouteSlot";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../client/ClientMyServicesPage", () => ({
  ClientMyServicesPage: () => <div data-testid="client-page">client</div>,
}));

vi.mock("../provider/ProviderMyServicesPage", () => ({
  ProviderMyServicesPage: () => <div data-testid="provider-page">provider</div>,
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));

describe("MyServicesRouteSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders client page for client role", () => {
    useAuth.mockReturnValue({ profile: { role: "client" } } as never);
    render(
      <MemoryRouter>
        <MyServicesRouteSlot />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("client-page")).toBeInTheDocument();
  });

  it("renders nothing for provider role", () => {
    useAuth.mockReturnValue({ profile: { role: "provider" } } as never);
    const { container } = render(
      <MemoryRouter>
        <MyServicesRouteSlot />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
