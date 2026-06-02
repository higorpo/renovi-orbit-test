import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMediaUploadSession,
  resolveChatImageDisplayUrls,
  uploadChatMedia,
} from "../chatMedia.api";

const rpcMock = vi.fn();
const invokeMock = vi.fn();
const getSessionMock = vi.fn();
const storageFromMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
    auth: {
      getSession: () => getSessionMock(),
    },
    storage: {
      from: (...args: unknown[]) => storageFromMock(...args),
    },
  },
}));

describe("createMediaUploadSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns session id from RPC", async () => {
    rpcMock.mockResolvedValue({
      data: {
        upload_session_id: "session-1",
        chat_id: "chat-1",
        expires_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });

    const result = await createMediaUploadSession("chat-1");

    expect(rpcMock).toHaveBeenCalledWith("cns_create_media_upload_session", {
      p_chat_id: "chat-1",
    });
    expect(result.error).toBeNull();
    expect(result.data?.upload_session_id).toBe("session-1");
  });
});

describe("uploadChatMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "user-token" } },
      error: null,
    });
  });

  it("invokes chat-upload-media with multipart form via supabase client", async () => {
    invokeMock.mockResolvedValue({
      data: { paths: ["chat/session/1.jpg"] },
      error: null,
    });

    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const result = await uploadChatMedia({
      chatId: "chat-1",
      uploadSessionId: "session-1",
      files: [file],
      idempotencyKey: "idem-1",
    });

    expect(result.error).toBeNull();
    expect(result.paths).toEqual(["chat/session/1.jpg"]);
    expect(invokeMock).toHaveBeenCalledWith(
      "chat-upload-media",
      expect.objectContaining({ body: expect.any(FormData) }),
    );

    const formData = invokeMock.mock.calls[0][1].body as FormData;
    expect(formData.get("chat_id")).toBe("chat-1");
    expect(formData.get("upload_session_id")).toBe("session-1");
    expect(formData.get("idempotency_key")).toBe("idem-1");
  });

  it("maps unauthorized to a user-friendly message", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: "unauthorized", name: "FunctionsHttpError" },
    });

    const result = await uploadChatMedia({
      chatId: "chat-1",
      uploadSessionId: "session-1",
      files: [new File(["x"], "a.jpg", { type: "image/jpeg" })],
    });

    expect(result.paths).toEqual([]);
    expect(result.error).toMatch(/login novamente/i);
  });
});

describe("resolveChatImageDisplayUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves signed URLs for authorized paths", async () => {
    rpcMock.mockResolvedValue({
      data: {
        bucket: "chat-media",
        expires_in: 3600,
        paths: ["chat/session/photo.jpg"],
      },
      error: null,
    });
    storageFromMock.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/photo.jpg" },
        error: null,
      }),
    });

    const result = await resolveChatImageDisplayUrls({
      messageId: "msg-1",
      paths: ["chat/session/photo.jpg"],
    });

    expect(result.error).toBeNull();
    expect(result.urls).toEqual(["https://signed.example/photo.jpg"]);
    expect(rpcMock).toHaveBeenCalledWith("cns_refresh_media_signed_urls", {
      p_message_ids: ["msg-1"],
      p_paths: ["chat/session/photo.jpg"],
      p_expires_in: 3600,
    });
  });
});
