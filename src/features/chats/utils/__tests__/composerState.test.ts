import { describe, expect, it } from "vitest";
import {
  CHAT_COMPOSER_DISABLED_COPY,
  deriveChatComposerState,
} from "../composerState";

describe("deriveChatComposerState", () => {
  it("disables input when free messaging is blocked by PENDING proposal", () => {
    const state = deriveChatComposerState({
      freeMessagingAllowed: false,
      conversationStatus: "ACTIVE",
      isLoading: false,
    });

    expect(state.isInputEnabled).toBe(false);
    expect(state.disabledReason).toBe("pending_proposal");
    expect(state.helperText).toBe(CHAT_COMPOSER_DISABLED_COPY.pendingProposal);
  });

  it("enables input when free messaging is allowed (REVISION_REQUESTED path)", () => {
    const state = deriveChatComposerState({
      freeMessagingAllowed: true,
      conversationStatus: "ACTIVE",
      isLoading: false,
    });

    expect(state.isInputEnabled).toBe(true);
    expect(state.disabledReason).toBeNull();
  });

  it("disables input when conversation is closed", () => {
    const state = deriveChatComposerState({
      freeMessagingAllowed: true,
      conversationStatus: "CLOSED",
      isLoading: false,
    });

    expect(state.isInputEnabled).toBe(false);
    expect(state.disabledReason).toBe("conversation_closed");
  });
});
