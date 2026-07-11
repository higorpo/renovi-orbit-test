// @vitest-environment happy-dom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatComposerAttachmentPreview } from "../ChatComposerAttachmentPreview";

describe("ChatComposerAttachmentPreview", () => {
  it("renders nothing when there are no previews", () => {
    const { container } = render(
      <ChatComposerAttachmentPreview previewUrls={[]} onRemove={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders previews and removes by index", () => {
    const onRemove = vi.fn();

    render(
      <ChatComposerAttachmentPreview
        previewUrls={["blob:a", "blob:b"]}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByAltText("Anexo 1")).toHaveAttribute("src", "blob:a");
    expect(screen.getByAltText("Anexo 2")).toHaveAttribute("src", "blob:b");

    fireEvent.click(screen.getByRole("button", { name: "Remover imagem 2" }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });
});
