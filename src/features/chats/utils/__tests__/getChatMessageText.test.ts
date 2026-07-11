import { describe, expect, it } from "vitest";
import type { ChatMessageListItem } from "../../types/chats.types";
import { getChatMessageText } from "../getChatMessageText";

const base: ChatMessageListItem = {
  id: "m1",
  chat_id: "c1",
  sender_user_id: "u1",
  message_type: "TEXT",
  payload: {},
  linked_entity_type: null,
  linked_entity_id: null,
  idempotency_key: "k1",
  delivery_status: "SENT",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("getChatMessageText", () => {
  it("returns trimmed text payload for TEXT messages", () => {
    expect(getChatMessageText({ ...base, payload: { text: "  Olá  " } })).toBe("Olá");
  });

  it("falls back when TEXT payload is empty", () => {
    expect(getChatMessageText(base)).toBe("Mensagem");
    expect(getChatMessageText({ ...base, payload: { text: "   " } })).toBe("Mensagem");
  });

  it("returns audio preview or default label for AUDIO messages", () => {
    expect(
      getChatMessageText({
        ...base,
        message_type: "AUDIO",
        payload: { preview: "  Áudio curto  " },
      }),
    ).toBe("Áudio curto");
    expect(getChatMessageText({ ...base, message_type: "AUDIO", payload: {} })).toBe("Áudio");
  });

  it("returns trimmed text payload for SYSTEM and WORKFLOW_ACTION messages", () => {
    expect(
      getChatMessageText({
        ...base,
        message_type: "SYSTEM",
        payload: { text: "  Outra proposta foi aceita neste pedido.  " },
      }),
    ).toBe("Outra proposta foi aceita neste pedido.");

    expect(
      getChatMessageText({
        ...base,
        message_type: "WORKFLOW_ACTION",
        payload: { text: "  Ação concluída  " },
      }),
    ).toBe("Ação concluída");
  });

  it("falls back to preview for other message types", () => {
    expect(
      getChatMessageText({
        ...base,
        message_type: "IMAGE",
        payload: { preview: "  Foto do vazamento  " },
      }),
    ).toBe("Foto do vazamento");

    expect(
      getChatMessageText({
        ...base,
        message_type: "IMAGE",
        payload: { preview: "   " },
      }),
    ).toBe("Mensagem");
  });
});
