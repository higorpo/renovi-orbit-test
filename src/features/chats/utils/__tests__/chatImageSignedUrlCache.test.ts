import { describe, expect, it } from "vitest";
import {
  buildChatImageDisplayCacheKey,
  clearChatImageSignedUrlCacheForTests,
  getCachedChatImageDisplayUrls,
  setCachedChatImageDisplayUrls,
} from "../chatImageSignedUrlCache";

describe("chatImageSignedUrlCache", () => {
  it("stores and retrieves urls by message id and paths", () => {
    clearChatImageSignedUrlCacheForTests();
    const key = buildChatImageDisplayCacheKey("msg-1", ["chat/s/a.png"]);

    expect(getCachedChatImageDisplayUrls(key)).toBeNull();

    setCachedChatImageDisplayUrls(key, ["https://signed.example/a.png"]);

    expect(getCachedChatImageDisplayUrls(key)).toEqual(["https://signed.example/a.png"]);
  });
});
