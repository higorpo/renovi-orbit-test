// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/features/auth";
import type { ConversationDetailResponse } from "../../../types/chats.types";
import { ChatDetailsDesktopPanel } from "../ChatDetailsDesktopPanel";

vi.mock("../ChatDetailsPanel", () => ({
  ChatDetailsPanel: ({
    onArchive,
    isArchiving,
  }: {
    onArchive: () => void;
    isArchiving?: boolean;
  }) => (
    <div data-testid="details-panel">
      <button type="button" onClick={onArchive}>
        {isArchiving ? "Archiving" : "Archive"}
      </button>
    </div>
  ),
}));

const detail = {
  conversation: { id: "chat-1", status: "ACTIVE" },
} as ConversationDetailResponse;

const currentUser = { id: "user-1", role: "client", full_name: "Maria" } as Profile;

describe("ChatDetailsDesktopPanel", () => {
  it("closes the panel and forwards archive actions", () => {
    const onClose = vi.fn();
    const onArchive = vi.fn();

    render(
      <ChatDetailsDesktopPanel
        detail={detail}
        currentUser={currentUser}
        onClose={onClose}
        onArchive={onArchive}
      />,
    );

    expect(screen.getByTestId("chat-details-desktop-panel")).toBeTruthy();
    expect(screen.getByText("Detalhes")).toBeTruthy();
    expect(screen.getByTestId("details-panel")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes" }));
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchive).toHaveBeenCalledOnce();
  });
});
