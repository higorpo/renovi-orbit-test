import { describe, expect, it } from "vitest";
import {
  CHAT_COMPOSER_DISABLED_COPY,
  CHAT_COMPOSER_PLACEHOLDER_BLOCKED,
  deriveChatComposerState,
} from "../composerState";

describe("deriveChatComposerState", () => {
  it("disables input when free messaging is blocked by PENDING proposal (client copy)", () => {
    const state = deriveChatComposerState({
      freeMessagingAllowed: false,
      conversationStatus: "ACTIVE",
      isLoading: false,
      viewerRole: "client",
    });

    expect(state.isInputEnabled).toBe(false);
    expect(state.disabledReason).toBe("pending_proposal");
    expect(state.helperText).toBe(CHAT_COMPOSER_DISABLED_COPY.pendingProposalClient);
    expect(state.placeholder).toBe(CHAT_COMPOSER_PLACEHOLDER_BLOCKED);
  });

  it("shows provider-specific copy when free messaging is blocked by PENDING proposal", () => {
    const state = deriveChatComposerState({
      freeMessagingAllowed: false,
      conversationStatus: "ACTIVE",
      isLoading: false,
      viewerRole: "provider",
    });

    expect(state.isInputEnabled).toBe(false);
    expect(state.disabledReason).toBe("pending_proposal");
    expect(state.helperText).toBe(CHAT_COMPOSER_DISABLED_COPY.pendingProposalProvider);
    expect(state.placeholder).toBe(CHAT_COMPOSER_PLACEHOLDER_BLOCKED);
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
