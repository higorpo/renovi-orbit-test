import { describe, expect, it } from "vitest";
import {
  getChatImageCaption,
  getChatImagePathsFromPayload,
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
