// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import {
  ChatActionBannerOverlay,
  ChatActionBannerOverlayHost,
} from "../ChatActionBannerOverlay";

describe("ChatActionBannerOverlay", () => {
  it("exposes children and marks itself hidden when not displayed", () => {
    const ref = createRef<HTMLDivElement>();

    render(
      <ChatActionBannerOverlay ref={ref} isDisplayed={false}>
        <span>Banner content</span>
      </ChatActionBannerOverlay>,
    );

    expect(screen.getByText("Banner content")).toBeTruthy();
    expect(ref.current).toHaveAttribute("aria-hidden", "true");
  });

  it("marks itself visible when displayed", () => {
    const ref = createRef<HTMLDivElement>();

    render(
      <ChatActionBannerOverlay ref={ref} isDisplayed>
        <span>Visible banner</span>
      </ChatActionBannerOverlay>,
    );

    expect(ref.current).toHaveAttribute("aria-hidden", "false");
  });
});

describe("ChatActionBannerOverlayHost", () => {
  it("unmounts the overlay when show is false", () => {
    const { container } = render(
      <ChatActionBannerOverlayHost show={false} isDisplayed={false}>
        <span>Hidden</span>
      </ChatActionBannerOverlayHost>,
    );

    expect(container.textContent).toBe("");
  });

  it("mounts the overlay when show is true", () => {
    render(
      <ChatActionBannerOverlayHost show isDisplayed>
        <span>Mounted banner</span>
      </ChatActionBannerOverlayHost>,
    );

    expect(screen.getByText("Mounted banner")).toBeTruthy();
  });
});
