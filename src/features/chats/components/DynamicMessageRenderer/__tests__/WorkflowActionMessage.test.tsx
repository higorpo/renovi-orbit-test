// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChatMessageListItem } from "../../../types/chats.types";
import { WorkflowActionMessage } from "../WorkflowActionMessage";

const baseMessage: ChatMessageListItem = {
  id: "m1",
  chat_id: "c1",
  sender_user_id: "u1",
  message_type: "WORKFLOW_ACTION",
  payload: { text: "Proposta aceita", action_key: "proposal.accepted" },
  linked_entity_type: "workflow",
  linked_entity_id: "wf-1",
  idempotency_key: "k1",
  delivery_status: "SENT",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("WorkflowActionMessage", () => {
  it("renders workflow text and action key", () => {
    render(<WorkflowActionMessage message={baseMessage} />);

    expect(screen.getByText("Proposta aceita")).toBeTruthy();
    expect(screen.getByText("proposal.accepted")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("omits action key when payload does not include one", () => {
    render(
      <WorkflowActionMessage
        message={{
          ...baseMessage,
          payload: { text: "Serviço concluído" },
        }}
      />,
    );

    expect(screen.getByText("Serviço concluído")).toBeTruthy();
    expect(screen.queryByText("proposal.accepted")).toBeNull();
  });
});
