import { describe, expect, it } from "vitest";
import {
  buildImageMessageSendPayload,
  getChatImageCaption,
  getChatImagePathsFromPayload,
  getLocalPreviewUrlsFromPayload,
  stripClientOnlyImagePayloadFields,
} from "../chatMessageImagePaths";

describe("getChatImagePathsFromPayload", () => {
  it("returns storage paths from payload", () => {
    expect(
      getChatImagePathsFromPayload({
        paths: ["chat/session/a.png", "chat/session/b.png"],
        preview: "Foto",
      }),
    ).toEqual(["chat/session/a.png", "chat/session/b.png"]);
  });
});

describe("buildImageMessageSendPayload", () => {
  it("returns server-only IMAGE payload fields", () => {
    expect(
      buildImageMessageSendPayload({
        uploadSessionId: "session-1",
        paths: ["chat/s/a.png"],
        preview: "Foto",
      }),
    ).toEqual({
      upload_session_id: "session-1",
      paths: ["chat/s/a.png"],
      preview: "Foto",
    });
  });
});

describe("stripClientOnlyImagePayloadFields", () => {
  it("removes local_preview_urls from payload", () => {
    expect(
      stripClientOnlyImagePayloadFields({
        upload_session_id: "session-1",
        paths: ["chat/s/a.png"],
        preview: "Foto",
        local_preview_urls: ["blob:abc"],
      }),
    ).toEqual({
      upload_session_id: "session-1",
      paths: ["chat/s/a.png"],
      preview: "Foto",
    });
  });
});

describe("getLocalPreviewUrlsFromPayload", () => {
  it("returns client-only blob preview URLs", () => {
    expect(
      getLocalPreviewUrlsFromPayload({
        local_preview_urls: ["blob:abc", "blob:def"],
        paths: [],
      }),
    ).toEqual(["blob:abc", "blob:def"]);
  });
});

describe("getChatImageCaption", () => {
  it("returns user caption when present", () => {
    expect(getChatImageCaption({ preview: "Veja o problema aqui" })).toBe(
      "Veja o problema aqui",
    );
  });

  it("hides default photo labels", () => {
    expect(getChatImageCaption({ preview: "Foto" })).toBeNull();
    expect(getChatImageCaption({ preview: "📷 Foto" })).toBeNull();
    expect(getChatImageCaption({ preview: "3 fotos" })).toBeNull();
  });

  it("shows user caption from list-projected payload", () => {
    expect(
      getChatImageCaption({
        paths: ["chat-id/session-id/photo.jpg"],
        preview: "Veja o vazamento na parede",
      }),
    ).toBe("Veja o vazamento na parede");
  });
});
