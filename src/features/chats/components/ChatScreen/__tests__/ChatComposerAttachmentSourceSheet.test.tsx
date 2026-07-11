// @vitest-environment happy-dom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatComposerAttachmentSourceSheet } from "../ChatComposerAttachmentSourceSheet";

describe("ChatComposerAttachmentSourceSheet", () => {
  it("picks camera and closes the sheet", () => {
    const onOpenChange = vi.fn();
    const onPickCamera = vi.fn();

    render(
      <ChatComposerAttachmentSourceSheet
        open
        onOpenChange={onOpenChange}
        onPickCamera={onPickCamera}
        onPickGallery={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Tirar foto/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onPickCamera).toHaveBeenCalledTimes(1);
  });

  it("picks gallery and closes the sheet", () => {
    const onOpenChange = vi.fn();
    const onPickGallery = vi.fn();

    render(
      <ChatComposerAttachmentSourceSheet
        open
        onOpenChange={onOpenChange}
        onPickCamera={vi.fn()}
        onPickGallery={onPickGallery}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Escolher da galeria/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onPickGallery).toHaveBeenCalledTimes(1);
  });
});
