// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ChatDetailsActions,
  CloseConversationConfirmDialog,
} from "../ChatDetailsActions";

describe("ChatDetailsActions", () => {
  it("calls onArchive when the conversation can be closed", () => {
    const onArchive = vi.fn();
    render(<ChatDetailsActions canArchive onArchive={onArchive} />);

    fireEvent.click(screen.getByRole("button", { name: "Encerrar conversa" }));
    expect(onArchive).toHaveBeenCalledOnce();
  });

  it("disables archive and explains when the conversation is already closed", () => {
    render(<ChatDetailsActions canArchive={false} onArchive={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Encerrar conversa" })).toBeDisabled();
    expect(screen.getByText("Esta conversa já foi encerrada.")).toBeTruthy();
  });

  it("shows pending label while archiving", () => {
    render(<ChatDetailsActions canArchive isArchiving onArchive={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Encerrando conversa…" })).toBeDisabled();
  });
});

describe("CloseConversationConfirmDialog", () => {
  it("confirms close without dismissing via default alert action", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CloseConversationConfirmDialog
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Encerrar conversa" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("shows pending copy while the close mutation is in flight", () => {
    render(
      <CloseConversationConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isPending
      />,
    );

    expect(screen.getByRole("button", { name: "Encerrando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
