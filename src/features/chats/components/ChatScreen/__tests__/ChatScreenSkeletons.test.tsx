// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatListItemSkeleton } from "../../ChatListItem/ChatListItemSkeleton";
import { ChatScreenSkeleton } from "../ChatScreenSkeleton";
import { ChatTimelineSkeleton } from "../ChatTimelineSkeleton";

describe("chat loading skeletons", () => {
  it("renders the chat list item skeleton", () => {
    const { container } = render(<ChatListItemSkeleton className="extra" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden");
    expect(container.firstElementChild?.className).toContain("extra");
  });

  it("renders the timeline skeleton with loading label", () => {
    render(<ChatTimelineSkeleton className="timeline-extra" />);
    const root = screen.getByLabelText("Carregando mensagens");
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root.className).toContain("timeline-extra");
  });

  it("renders the full chat screen skeleton", () => {
    render(<ChatScreenSkeleton className="screen-extra" />);
    const root = screen.getByLabelText("Carregando conversa");
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root.className).toContain("screen-extra");
    expect(screen.getByLabelText("Carregando mensagens")).toBeTruthy();
  });
});
