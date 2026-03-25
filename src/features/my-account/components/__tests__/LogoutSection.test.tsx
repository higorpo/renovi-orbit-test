import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LogoutSection } from "../LogoutSection";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));

describe("LogoutSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      signOut: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("renders session title and sign-out button", () => {
    render(<LogoutSection />);
    expect(screen.getByText("Sessão")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sair da plataforma/ })
    ).toBeInTheDocument();
  });

  it("opens confirm dialog and calls signOut when user confirms", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    useAuth.mockReturnValue({ signOut } as unknown as ReturnType<typeof useAuth>);

    render(<LogoutSection />);
    fireEvent.click(screen.getByRole("button", { name: /Sair da plataforma/ }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/Você será desconectado da sua conta/)
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /^Sair$/ }));

    await vi.waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });
});
