// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConversationStatusBadge } from "../ConversationStatusBadge";

describe("ConversationStatusBadge", () => {
  it("renders the active conversation label", () => {
    render(<ConversationStatusBadge status="ACTIVE" />);
    expect(screen.getByText("Ativa")).toBeTruthy();
  });

  it("renders the closed conversation label", () => {
    render(<ConversationStatusBadge status="CLOSED" />);
    expect(screen.getByText("Encerrada")).toBeTruthy();
  });
});
