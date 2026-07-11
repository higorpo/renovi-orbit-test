// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatActionBanner, ChatActionBannerSlot } from "../ChatActionBanner";

const banner = {
  body: "Há uma proposta aguardando sua resposta.",
  ctaLabel: "Ver proposta",
  ctaAriaLabel: "Abrir detalhes da proposta",
  dismissAriaLabel: "Dispensar aviso da proposta",
};

describe("ChatActionBanner", () => {
  it("renders body and invokes primary and dismiss actions", () => {
    const onPrimaryAction = vi.fn();
    const onDismiss = vi.fn();

    render(
      <ChatActionBanner
        banner={banner}
        onPrimaryAction={onPrimaryAction}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText(banner.body)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: banner.ctaAriaLabel }));
    expect(onPrimaryAction).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: banner.dismissAriaLabel }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("ChatActionBannerSlot", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(
      <ChatActionBannerSlot
        banner={banner}
        isVisible={false}
        onPrimaryAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the banner when visible", () => {
    render(
      <ChatActionBannerSlot
        banner={banner}
        isVisible
        onPrimaryAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(banner.body)).toBeTruthy();
  });
});
