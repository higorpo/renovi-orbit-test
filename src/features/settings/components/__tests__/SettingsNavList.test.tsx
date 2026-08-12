import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SettingsNavList } from "../SettingsNavList";
import { getSettingsNavItems } from "../../constants/settingsNav";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));

function renderNav(role: "client" | "provider" = "client") {
  return render(
    <MemoryRouter>
      <SettingsNavList items={getSettingsNavItems(role)} variant="sidebar" />
    </MemoryRouter>,
  );
}

describe("SettingsNavList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      signOut: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("places Conta after Privacidade and Sair da conta below the divider", () => {
    renderNav();
    const links = screen.getAllByRole("link").map((el) => el.textContent);
    expect(links.indexOf("Privacidade")).toBeLessThan(links.indexOf("Conta"));
    expect(screen.getByRole("button", { name: "Sair da conta" })).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("opens logout confirmation from Sair da conta", async () => {
    renderNav();
    fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sair da conta" })).toBeInTheDocument();
  });
});
