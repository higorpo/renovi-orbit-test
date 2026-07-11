import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMediaUploadSession,
  resolveChatAudioSignedUrl,
  resolveChatImageDisplayUrls,
  uploadChatAudio,
  uploadChatMedia,
} from "../chatMedia.api";

const rpcMock = vi.fn();
const invokeMock = vi.fn();
const getSessionMock = vi.fn();
const storageFromMock = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

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

  it("maps RPC errors and rejects malformed responses", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "forbidden" },
    });
    await expect(createMediaUploadSession("chat-1")).resolves.toMatchObject({
      data: null,
      error: expect.any(Object),
    });

    rpcMock.mockResolvedValueOnce({ data: { upload_session_id: 123 }, error: null });
    await expect(createMediaUploadSession("chat-1")).resolves.toEqual({
      data: null,
      error: { code: "UNKNOWN", message: "Resposta inesperada do servidor." },
    });
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

  it("returns the session error before invoking upload", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: { message: "session failed" },
    });

    const result = await uploadChatMedia({
      chatId: "chat-1",
      uploadSessionId: "session-1",
      files: [],
    });

    expect(result).toEqual({ paths: [], error: "session failed" });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("returns edge body and invalid response errors", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: { error: "blocked" }, error: null })
      .mockResolvedValueOnce({ data: { paths: [123] }, error: null });
    const params = {
      chatId: "chat-1",
      uploadSessionId: "session-1",
      files: [new File(["x"], "", { type: "image/jpeg" })],
    };

    await expect(uploadChatMedia(params)).resolves.toEqual({ paths: [], error: "blocked" });
    await expect(uploadChatMedia(params)).resolves.toEqual({
      paths: [],
      error: "Resposta inválida do servidor.",
    });
  });

  it("returns media-specific network errors", async () => {
    invokeMock.mockRejectedValue(new Error("offline"));

    await expect(
      uploadChatMedia({
        chatId: "chat-1",
        uploadSessionId: "session-1",
        files: [],
      }),
    ).resolves.toEqual({
      paths: [],
      error: "Não foi possível enviar as imagens. Verifique sua conexão.",
    });

    await expect(
      uploadChatMedia({
        chatId: "chat-1",
        uploadSessionId: "session-1",
        files: [],
        mediaKind: "audio",
      }),
    ).resolves.toEqual({
      paths: [],
      error: "Não foi possível enviar o áudio. Verifique sua conexão.",
    });
  });

  it("adapts successful and failed audio uploads", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: { paths: ["chat/audio.webm"] }, error: null })
      .mockResolvedValueOnce({ data: { error: "audio blocked" }, error: null })
      .mockResolvedValueOnce({ data: { paths: [] }, error: null });
    const params = {
      chatId: "chat-1",
      uploadSessionId: "session-1",
      file: new File(["audio"], "voice.webm", { type: "audio/webm" }),
    };

    await expect(uploadChatAudio(params)).resolves.toEqual({
      path: "chat/audio.webm",
      error: null,
    });
    await expect(uploadChatAudio(params)).resolves.toEqual({
      path: null,
      error: "audio blocked",
    });
    await expect(uploadChatAudio(params)).resolves.toEqual({
      path: null,
      error: "Resposta inválida do servidor.",
    });
  });

  it("returns Usuário não autenticado when session is null without sessionError", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(
      uploadChatMedia({
        chatId: "chat-1",
        uploadSessionId: "session-1",
        files: [new File(["x"], "a.jpg", { type: "image/jpeg" })],
      }),
    ).resolves.toEqual({
      paths: [],
      error: "Usuário não autenticado",
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("omits idempotency_key from FormData when not provided", async () => {
    invokeMock.mockResolvedValue({ data: { paths: ["chat/a.jpg"] }, error: null });

    await uploadChatMedia({
      chatId: "chat-1",
      uploadSessionId: "session-1",
      files: [new File(["x"], "a.jpg", { type: "image/jpeg" })],
    });

    const formData = invokeMock.mock.calls[0]?.[1]?.body as FormData;
    expect(formData.get("idempotency_key")).toBeNull();
  });

  it("uses audio fallback filename when file.name is empty", async () => {
    invokeMock.mockResolvedValue({ data: { paths: ["chat/audio.webm"] }, error: null });
    const nameless = new File(["audio"], "", { type: "audio/webm" });

    await uploadChatMedia({
      chatId: "chat-1",
      uploadSessionId: "session-1",
      files: [nameless],
      mediaKind: "audio",
    });

    const formData = invokeMock.mock.calls[0]?.[1]?.body as FormData;
    const appended = formData.get("file") as File;
    expect(appended.name).toBe("audio-0.webm");
  });

  it("rejects malformed refresh payload when paths contains non-strings", async () => {
    rpcMock.mockResolvedValue({
      data: { bucket: "chat-media", expires_in: 60, paths: [1, 2] },
      error: null,
    });

    await expect(
      resolveChatImageDisplayUrls({ paths: ["a.png"] }),
    ).resolves.toEqual({
      urls: [],
      error: "Resposta inesperada do servidor.",
    });
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

  it("skips the RPC when no server identifiers are available", async () => {
    await expect(
      resolveChatImageDisplayUrls({ messageId: "optimistic:key", paths: [] }),
    ).resolves.toEqual({ urls: [], error: null });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns refresh RPC and malformed response errors", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { message: "refresh failed" } })
      .mockResolvedValueOnce({ data: { bucket: "chat-media", paths: [] }, error: null });

    await expect(
      resolveChatImageDisplayUrls({ messageId: "msg-1" }),
    ).resolves.toEqual({ urls: [], error: "refresh failed" });
    await expect(
      resolveChatImageDisplayUrls({ paths: ["chat/photo.jpg"] }),
    ).resolves.toEqual({ urls: [], error: "Resposta inesperada do servidor." });
  });

  it("keeps valid signed URLs when another path fails", async () => {
    rpcMock.mockResolvedValue({
      data: {
        bucket: "chat-media",
        expires_in: 60,
        paths: ["bad.jpg", "good.jpg"],
      },
      error: null,
    });
    const createSignedUrl = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "missing" } })
      .mockResolvedValueOnce({ data: { signedUrl: "https://signed/good.jpg" }, error: null });
    storageFromMock.mockReturnValue({ createSignedUrl });

    await expect(
      resolveChatImageDisplayUrls({ paths: ["bad.jpg", "good.jpg"] }),
    ).resolves.toEqual({ urls: ["https://signed/good.jpg"], error: null });
  });

  it("returns an image error when every signing attempt fails", async () => {
    rpcMock.mockResolvedValue({
      data: { bucket: "chat-media", expires_in: 60, paths: ["bad.jpg"] },
      error: null,
    });
    storageFromMock.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(
      resolveChatImageDisplayUrls({ paths: ["bad.jpg"] }),
    ).resolves.toEqual({ urls: [], error: "Não foi possível carregar a imagem." });
  });
});

describe("resolveChatAudioSignedUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the first signed audio URL", async () => {
    rpcMock.mockResolvedValue({
      data: { bucket: "chat-media", expires_in: 60, paths: ["audio.webm"] },
      error: null,
    });
    storageFromMock.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed/audio.webm" },
        error: null,
      }),
    });

    await expect(
      resolveChatAudioSignedUrl({ messageId: "msg-1", path: "audio.webm" }),
    ).resolves.toEqual({ url: "https://signed/audio.webm", error: null });
  });

  it("forwards signing errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "denied" } });

    await expect(resolveChatAudioSignedUrl({ path: "audio.webm" })).resolves.toEqual({
      url: null,
      error: "denied",
    });
  });

  it("returns a friendly audio error when signing succeeds without a URL", async () => {
    rpcMock.mockResolvedValue({
      data: { bucket: "chat-media", expires_in: 60, paths: ["audio.webm"] },
      error: null,
    });
    storageFromMock.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(resolveChatAudioSignedUrl({ path: "audio.webm" })).resolves.toEqual({
      url: null,
      error: "Não foi possível carregar o áudio.",
    });
  });
});

describe("uploadChatMedia FunctionsHttpError bodies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "user-token" } },
      error: null,
    });
  });

  it("reads error and message fields from the edge response body", async () => {
    const { FunctionsHttpError } = await import("@supabase/supabase-js");

    const errorWithBody = Object.assign(
      new FunctionsHttpError({
        json: async () => ({ error: "quota exceeded" }),
      } as Response),
      { message: "Edge Function returned a non-2xx status code" },
    );
    invokeMock.mockResolvedValueOnce({ data: null, error: errorWithBody });

    await expect(
      uploadChatMedia({
        chatId: "chat-1",
        uploadSessionId: "session-1",
        files: [new File(["x"], "a.jpg", { type: "image/jpeg" })],
      }),
    ).resolves.toEqual({ paths: [], error: "quota exceeded" });

    const errorWithMessage = Object.assign(
      new FunctionsHttpError({
        json: async () => ({ message: "too large" }),
      } as Response),
      { message: "Edge Function returned a non-2xx status code" },
    );
    invokeMock.mockResolvedValueOnce({ data: null, error: errorWithMessage });

    await expect(
      uploadChatMedia({
        chatId: "chat-1",
        uploadSessionId: "session-1",
        files: [new File(["x"], "a.jpg", { type: "image/jpeg" })],
      }),
    ).resolves.toEqual({ paths: [], error: "too large" });
  });

  it("maps unauthorized audio uploads to an audio-specific login message", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: "unauthorized", name: "FunctionsHttpError" },
    });

    await expect(
      uploadChatMedia({
        chatId: "chat-1",
        uploadSessionId: "session-1",
        files: [new File(["a"], "voice.webm", { type: "audio/webm" })],
        mediaKind: "audio",
      }),
    ).resolves.toEqual({
      paths: [],
      error: "Sessão expirada ou inválida. Faça login novamente e tente enviar o áudio.",
    });
  });

  it("falls back to the error message when the edge body cannot be parsed", async () => {
    const { FunctionsHttpError } = await import("@supabase/supabase-js");
    const error = Object.assign(
      new FunctionsHttpError({
        json: async () => {
          throw new Error("bad json");
        },
      } as Response),
      { message: "edge boom" },
    );
    invokeMock.mockResolvedValue({ data: null, error });

    await expect(
      uploadChatMedia({
        chatId: "chat-1",
        uploadSessionId: "session-1",
        files: [new File(["x"], "a.jpg", { type: "image/jpeg" })],
      }),
    ).resolves.toEqual({ paths: [], error: "edge boom" });
  });

  it("falls back when the edge error context has no JSON body", async () => {
    const { FunctionsHttpError } = await import("@supabase/supabase-js");
    const errorWithoutJson = Object.assign(
      Object.create(FunctionsHttpError.prototype) as FunctionsHttpError,
      {
        context: null,
        message: "edge unavailable",
      },
    );
    invokeMock.mockResolvedValue({ data: null, error: errorWithoutJson });

    await expect(
      uploadChatMedia({
        chatId: "chat-1",
        uploadSessionId: "session-1",
        files: [new File(["x"], "a.jpg", { type: "image/jpeg" })],
      }),
    ).resolves.toEqual({ paths: [], error: "edge unavailable" });
  });
});

describe("chatMedia additional fallback branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "user-token" } },
      error: null,
    });
  });

  it.each([
    ["null payload", null],
    ["primitive payload", "invalid"],
    ["missing chat id", { upload_session_id: "session-1" }],
    ["missing upload session id", { chat_id: "chat-1" }],
  ])("rejects create-session %s", async (_label, data) => {
    rpcMock.mockResolvedValue({ data, error: null });

    await expect(createMediaUploadSession("chat-1")).resolves.toEqual({
      data: null,
      error: { code: "UNKNOWN", message: "Resposta inesperada do servidor." },
    });
  });

  it("uses image defaults for media kind and an unnamed file", async () => {
    invokeMock.mockResolvedValue({ data: { paths: ["chat/image.jpg"] }, error: null });

    await uploadChatMedia({
      chatId: "chat-1",
      uploadSessionId: "session-1",
      files: [new File(["image"], "", { type: "image/jpeg" })],
    });

    const formData = invokeMock.mock.calls[0]?.[1]?.body as FormData;
    expect(formData.get("media_kind")).toBe("image");
    expect((formData.get("file") as File).name).toBe("image-0.jpg");
  });

  it("maps non-Error upload rejections to the image network message", async () => {
    invokeMock.mockRejectedValue("offline");

    await expect(
      uploadChatMedia({
        chatId: "chat-1",
        uploadSessionId: "session-1",
        files: [],
      }),
    ).resolves.toEqual({
      paths: [],
      error: "Não foi possível enviar as imagens. Verifique sua conexão.",
    });
  });

  it("ignores optimistic message ids while still resolving explicit paths", async () => {
    rpcMock.mockResolvedValue({
      data: { bucket: "chat-media", expires_in: 60, paths: ["photo.jpg"] },
      error: null,
    });
    storageFromMock.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed/photo.jpg" },
        error: null,
      }),
    });

    await resolveChatImageDisplayUrls({
      messageId: "optimistic:key",
      paths: ["photo.jpg"],
    });

    expect(rpcMock).toHaveBeenCalledWith("cns_refresh_media_signed_urls", {
      p_message_ids: undefined,
      p_paths: ["photo.jpg"],
      p_expires_in: 3600,
    });
  });
});
