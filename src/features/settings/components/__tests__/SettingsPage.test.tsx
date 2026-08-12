import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsPage } from "../SettingsPage";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../SettingsClientPage", () => ({
  SettingsClientPage: () => <div data-testid="client-page">Client page</div>,
}));

vi.mock("../SettingsProviderPage", () => ({
  SettingsProviderPage: () => <div data-testid="provider-page">Provider page</div>,
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton when loading is true", () => {
    useAuth.mockReturnValue({
      profile: null,
      loading: true,
    } as ReturnType<typeof useAuth>);

    render(<SettingsPage />);

    const container = document.querySelector(".container");
    expect(container).toBeInTheDocument();
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByTestId("client-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("provider-page")).not.toBeInTheDocument();
  });

  it("renders loading skeleton when profile is null", () => {
    useAuth.mockReturnValue({
      profile: null,
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(<SettingsPage />);

    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders provider page when profile.role is provider", () => {
    useAuth.mockReturnValue({
      profile: { id: "p1", role: "provider" },
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(<SettingsPage />);

    expect(screen.getByTestId("provider-page")).toBeInTheDocument();
    expect(screen.getByText("Provider page")).toBeInTheDocument();
    expect(screen.queryByTestId("client-page")).not.toBeInTheDocument();
  });

  it("renders client page when profile.role is client", () => {
    useAuth.mockReturnValue({
      profile: { id: "c1", role: "client" },
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(<SettingsPage />);

    expect(screen.getByTestId("client-page")).toBeInTheDocument();
    expect(screen.getByText("Client page")).toBeInTheDocument();
    expect(screen.queryByTestId("provider-page")).not.toBeInTheDocument();
  });
});
