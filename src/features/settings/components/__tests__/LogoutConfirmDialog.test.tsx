import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LogoutConfirmDialog } from "../LogoutConfirmDialog";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));

describe("LogoutConfirmDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      signOut: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("calls signOut when the user confirms", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    useAuth.mockReturnValue({ signOut } as unknown as ReturnType<typeof useAuth>);

    render(<LogoutConfirmDialog open onOpenChange={onOpenChange} />);

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("heading", { name: "Sair da conta" })).toBeInTheDocument();
    expect(within(dialog).getByText(/Você será desconectado da sua conta/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /^Sair$/ }));

    await vi.waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });

  it("does not call signOut when cancelled", async () => {
    const signOut = vi.fn();
    const onOpenChange = vi.fn();
    useAuth.mockReturnValue({ signOut } as unknown as ReturnType<typeof useAuth>);

    render(<LogoutConfirmDialog open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(signOut).not.toHaveBeenCalled();
  });
});
