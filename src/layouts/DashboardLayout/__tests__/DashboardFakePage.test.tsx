import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardFakePage } from "../DashboardFakePage";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));

describe("DashboardFakePage", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      profile: { id: "p1", role: "client", full_name: "User" },
      user: null,
      loadingSession: false,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      getRedirectPath: vi.fn(),
    } as ReturnType<typeof useAuth>);
  });

  it("renders title prop when provided", () => {
    render(<DashboardFakePage title="Minha Página" />);
    expect(screen.getByRole("heading", { name: "Minha Página" })).toBeInTheDocument();
  });

  it("renders titleByRole client label when role is client", () => {
    render(
      <DashboardFakePage
        titleByRole={{ client: "Meus pedidos", provider: "Solicitações" }}
      />
    );
    expect(screen.getByRole("heading", { name: "Meus pedidos" })).toBeInTheDocument();
  });

  it("renders titleByRole provider label when role is provider", () => {
    useAuth.mockReturnValue({
      profile: { id: "p1", role: "provider", full_name: "Provider" },
      user: null,
      loadingSession: false,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      getRedirectPath: vi.fn(),
    } as ReturnType<typeof useAuth>);
    render(
      <DashboardFakePage
        titleByRole={{ client: "Meus pedidos", provider: "Solicitações" }}
      />
    );
    expect(screen.getByRole("heading", { name: "Solicitações" })).toBeInTheDocument();
  });

  it("renders default Dashboard when no title nor titleByRole", () => {
    render(<DashboardFakePage />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("renders default Dashboard when profile is null (role defaults to client)", () => {
    useAuth.mockReturnValue({
      profile: null,
      user: null,
      loadingSession: false,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      getRedirectPath: vi.fn(),
    } as ReturnType<typeof useAuth>);
    render(<DashboardFakePage />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("prefers title over titleByRole when both are provided", () => {
    render(
      <DashboardFakePage
        title="Custom"
        titleByRole={{ client: "Meus pedidos", provider: "Solicitações" }}
      />
    );
    expect(screen.getByRole("heading", { name: "Custom" })).toBeInTheDocument();
  });

  it("renders construction message", () => {
    render(<DashboardFakePage title="Test" />);
    expect(screen.getByText("Página em construção.")).toBeInTheDocument();
  });

  it("renders inside a card", () => {
    render(<DashboardFakePage title="Test" />);
    const heading = screen.getByRole("heading", { name: "Test" });
    expect(heading.closest("[class*='rounded']")).toBeInTheDocument();
  });
});
