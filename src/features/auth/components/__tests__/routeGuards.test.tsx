import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { ProtectedRoute, GuestOnlyRoute } from "../routeGuards";
import type { Profile } from "../../types/auth.types";

const navigate = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("@/lib/sentry", () => ({
  addBreadcrumb: vi.fn(),
}));

const clientProfile: Profile = {
  id: "u1",
  role: "client",
  full_name: "User",
};

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading placeholder while loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: true,
      getRedirectPath: vi.fn(),
    });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Secret</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    const loading = screen.getByText("Carregando...");
    expect(loading.parentElement).toHaveAttribute("aria-busy", "true");
  });

  it("redirects unauthenticated users to login with redirect param", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      getRedirectPath: vi.fn(() => "/dashboard"),
    });
    render(
      <MemoryRouter initialEntries={["/secret?q=1"]}>
        <Routes>
          <Route
            path="/secret"
            element={
              <ProtectedRoute>
                <div>Secret</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        expect.stringContaining("/login?redirect="),
        { replace: true }
      );
    });
  });

  it("renders children when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: clientProfile,
      loading: false,
      getRedirectPath: vi.fn(() => "/dashboard/client"),
    });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Secret</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByText("Secret")).toBeInTheDocument();
  });

  it("redirects when role not allowed", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: clientProfile,
      loading: false,
      getRedirectPath: vi.fn(() => "/dashboard/client"),
    });
    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={["provider"]}>
          <div>Admin</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/dashboard/client", { replace: true });
    });
  });

  it("uses forbiddenRedirect when role not allowed", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: clientProfile,
      loading: false,
      getRedirectPath: vi.fn(),
    });
    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={["provider"]} forbiddenRedirect="/other">
          <div>X</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/other", { replace: true });
    });
  });
});

describe("GuestOnlyRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading while auth loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: true,
      getRedirectPath: vi.fn(),
    });
    render(
      <MemoryRouter>
        <GuestOnlyRoute>
          <div>Login form</div>
        </GuestOnlyRoute>
      </MemoryRouter>
    );
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
  });

  it("renders children when guest", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      getRedirectPath: vi.fn(),
    });
    render(
      <MemoryRouter>
        <GuestOnlyRoute>
          <div>Login form</div>
        </GuestOnlyRoute>
      </MemoryRouter>
    );
    expect(screen.getByText("Login form")).toBeInTheDocument();
  });

  it("redirects authenticated client to dashboard", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: clientProfile,
      loading: false,
      getRedirectPath: vi.fn(() => "/dashboard/client"),
    });
    render(
      <MemoryRouter>
        <GuestOnlyRoute>
          <div>Login</div>
        </GuestOnlyRoute>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/dashboard/client", { replace: true });
    });
  });

  it("uses safe redirect query when valid", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: clientProfile,
      loading: false,
      getRedirectPath: vi.fn(() => "/dashboard/client"),
    });
    render(
      <MemoryRouter initialEntries={["/login?redirect=/pedir-orcamento"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestOnlyRoute>
                <div>Login</div>
              </GuestOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/pedir-orcamento", { replace: true });
    });
  });

  it("ignores unsafe redirect (open redirect)", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: clientProfile,
      loading: false,
      getRedirectPath: vi.fn(() => "/safe"),
    });
    render(
      <MemoryRouter initialEntries={["/login?redirect=https://evil.com"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestOnlyRoute>
                <div>Login</div>
              </GuestOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/safe", { replace: true });
    });
  });
});
