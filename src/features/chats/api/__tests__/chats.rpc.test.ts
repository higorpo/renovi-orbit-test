import { describe, expect, it } from "vitest";
import { CNS_CHAT_RPC } from "../chats.rpc";

describe("CNS_CHAT_RPC", () => {
  it("exposes the CNS RPC names used by the chats API", () => {
    expect(CNS_CHAT_RPC.sendMessage).toBe("cns_send_message");
    expect(CNS_CHAT_RPC.listConversations).toBe("list_conversations");
    expect(CNS_CHAT_RPC.getConversationDetail).toBe("get_conversation_detail");
    expect(CNS_CHAT_RPC.markConversationRead).toBe("cns_mark_conversation_read");
    expect(CNS_CHAT_RPC.createMediaUploadSession).toBe("cns_create_media_upload_session");
  });
});
