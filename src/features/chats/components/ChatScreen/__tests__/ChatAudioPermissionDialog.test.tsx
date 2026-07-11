// @vitest-environment happy-dom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ChatAudioPermissionBlockedDialog,
  ChatAudioPermissionDialog,
} from "../ChatAudioPermissionDialog";

vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({
    contentRef: { current: null },
    scheduleSync: vi.fn(),
  }),
}));

describe("ChatAudioPermissionDialog", () => {
  it("accepts and dismisses permission request", () => {
    const onAccept = vi.fn();
    const onDismiss = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ChatAudioPermissionDialog
        open
        onOpenChange={onOpenChange}
        onAccept={onAccept}
        onDismiss={onDismiss}
        requesting={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onAccept).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows requesting state and disables dismiss while requesting", () => {
    render(
      <ChatAudioPermissionDialog
        open
        onOpenChange={vi.fn()}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        requesting
      />,
    );

    expect(screen.getByRole("button", { name: /Aguarde/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agora não" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled();
  });
});

describe("ChatAudioPermissionBlockedDialog", () => {
  it("shows settings action when available", () => {
    const onOpenSettings = vi.fn();
    const onDismiss = vi.fn();

    render(
      <ChatAudioPermissionBlockedDialog
        open
        onOpenChange={vi.fn()}
        onOpenSettings={onOpenSettings}
        onDismiss={onDismiss}
        showOpenSettings
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir configurações" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("shows web settings hint when open-settings is unavailable", () => {
    render(
      <ChatAudioPermissionBlockedDialog
        open
        onOpenChange={vi.fn()}
        onOpenSettings={vi.fn()}
        onDismiss={vi.fn()}
        showOpenSettings={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Abrir configurações" })).toBeNull();
    expect(
      screen.getByText(/abra as configurações do site/i),
    ).toBeInTheDocument();
  });
});
