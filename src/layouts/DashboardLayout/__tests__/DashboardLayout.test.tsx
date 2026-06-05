import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { DashboardLayout } from "../DashboardLayout";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: vi.fn(),
}));

vi.mock("@/features/provider-jobs", () => ({
  ProviderJobsPersistentSlot: () => null,
}));

vi.mock("@/features/provider-budgets", () => ({
  ProviderBudgetsPersistentSlot: () => null,
}));

vi.mock("@/features/view-services", () => ({
  ServiceDetailSheet: () => null,
  useServiceDetailModal: () => ({
    isOpen: false,
    isFromProviderJobs: false,
    isFromProviderBudgets: false,
    serviceRequestId: undefined,
    background: null,
  }),
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

  it("renders desktop header with Renovi logo when useBreakpointMd is true", () => {
    useBreakpointMd.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    const logo = screen.getByRole("img", { name: "Renovi" });
    expect(logo).toBeInTheDocument();
    const logoLink = screen.getByRole("link", { name: "Renovi" });
    expect(logoLink.getAttribute("href")).toMatch(/^\/(dashboard)?$/);
    expect(screen.getByRole("navigation", { name: "Dashboard navigation" })).toBeInTheDocument();
  });

  it("renders desktop header with logo when role is provider", () => {
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
    expect(screen.getByRole("img", { name: "Renovi" })).toBeInTheDocument();
  });

  it("renders desktop header with logo when profile is null", () => {
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
    expect(screen.getByRole("img", { name: "Renovi" })).toBeInTheDocument();
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
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    const main = screen.getByRole("main");
    expect(main).toHaveClass("pb-20");
  });

  it("hides mobile nav on a specific chat conversation route", () => {
    useBreakpointMd.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={["/dashboard/chats/chat-1"]}>
        <Routes>
          <Route path="/dashboard/chats/:chatId" element={<DashboardLayout />}>
            <Route index element={null} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Abrir menu" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Navegação principal" })).toBeNull();
    expect(screen.getByRole("main")).not.toHaveClass("pb-20");
    expect(screen.getByRole("main")).toHaveClass("overflow-hidden");
  });
});
