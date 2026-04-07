import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Login from "../Login";

const signIn = vi.fn().mockResolvedValue(undefined);
const signInWithGoogle = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    signIn,
    signInWithGoogle,
  }),
}));

vi.mock("../../../hooks/useOAuthErrorFromUrl", () => ({
  useOAuthErrorFromUrl: vi.fn(),
}));

vi.mock("../../../utils/persistSession", () => ({
  getPersistSession: vi.fn(() => true),
  setPersistSession: vi.fn(),
}));

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_MAIN_SITE_URL", "https://site.example.com");
  });

  it("renders title and form", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: /Bem-vindo de volta/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar na minha conta/i })).toBeInTheDocument();
  });

  it("links to signup routes", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: /Sou Cliente/i })).toHaveAttribute(
      "href",
      "/cadastro/cliente"
    );
    expect(screen.getByRole("link", { name: /Sou Profissional/i })).toHaveAttribute(
      "href",
      "/cadastro/profissional"
    );
  });

  it("renders legal links with main site URL", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    const termos = screen.getByRole("link", { name: /Termos de Uso/i });
    expect(termos.getAttribute("href")).toContain("site.example.com");
    expect(termos.getAttribute("href")).toContain("termos-de-uso");
  });

  it("submits credentials", async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "user@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Sua senha/i), {
      target: { value: "Password1!xx" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Entrar na minha conta/i }));
    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("user@test.com", "Password1!xx");
    });
  });
});
