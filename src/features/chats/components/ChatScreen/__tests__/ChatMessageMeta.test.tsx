// @vitest-environment happy-dom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMessageMeta } from "../ChatMessageMeta";

describe("ChatMessageMeta", () => {
  it("returns null when neither timestamp nor receipt should show", () => {
    const { container } = render(
      <ChatMessageMeta
        createdAt="2026-06-01T10:00:00.000Z"
        isOutgoing
        showTimestamp={false}
        showReadReceipt={false}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows timestamp only for incoming messages", () => {
    render(
      <ChatMessageMeta
        createdAt="2026-06-01T10:00:00.000Z"
        isOutgoing={false}
        showTimestamp
        showReadReceipt={false}
      />,
    );

    const label = screen.getByLabelText(/\d/);
    expect(label).toBeInTheDocument();
    expect(screen.queryByText(/Visualizado/)).toBeNull();
  });

  it("shows timestamp and read receipt for outgoing messages", () => {
    render(
      <ChatMessageMeta
        createdAt="2026-06-01T10:00:00.000Z"
        isOutgoing
        showTimestamp
        showReadReceipt
      />,
    );

    expect(screen.getByText(/Visualizado/)).toBeInTheDocument();
    expect(screen.getByLabelText(/visualizado/i)).toBeInTheDocument();
  });

  it("shows read receipt only when timestamp is hidden", () => {
    render(
      <ChatMessageMeta
        createdAt="2026-06-01T10:00:00.000Z"
        isOutgoing
        showTimestamp={false}
        showReadReceipt
      />,
    );

    expect(screen.getByLabelText("Visualizado")).toBeInTheDocument();
    expect(screen.getByText("Visualizado")).toBeInTheDocument();
  });
});
