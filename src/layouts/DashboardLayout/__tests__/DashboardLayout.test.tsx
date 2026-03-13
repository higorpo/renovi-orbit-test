import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DashboardLayout } from "../DashboardLayout";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: vi.fn(),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const useBreakpointMd = vi.mocked(
  await import("@/hooks/useBreakpoint").then((m) => m.useBreakpointMd)
);

describe("DashboardLayout", () => {
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

  it("renders desktop header with client title when useBreakpointMd is true and role is client", () => {
    useBreakpointMd.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    expect(screen.getByText("Área do cliente")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Dashboard navigation" })).toBeInTheDocument();
  });

  it("renders desktop header with provider title when role is provider", () => {
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
    useBreakpointMd.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    expect(screen.getByText("Prestador")).toBeInTheDocument();
  });

  it("defaults to client title when profile is null", () => {
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
    useBreakpointMd.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    expect(screen.getByText("Área do cliente")).toBeInTheDocument();
  });

  it("renders mobile nav when useBreakpointMd is false", () => {
    useBreakpointMd.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: "Abrir menu" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument();
  });

  it("renders main with Outlet", () => {
    useBreakpointMd.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main.tagName).toBe("MAIN");
  });

  it("applies padding bottom to main on mobile so content is not under bottom nav", () => {
    useBreakpointMd.mockReturnValue(false);
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    const main = screen.getByRole("main");
    expect(main).toHaveClass("pb-20");
  });
});
