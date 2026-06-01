import { describe, expect, it } from "vitest";
import {
  CHAT_NEAR_BOTTOM_THRESHOLD_PX,
  getChatDistanceFromBottom,
  getScrollTopAfterPrepend,
  isNearChatBottom,
} from "../chatTimelineScroll";

describe("chatTimelineScroll", () => {
  it("computes distance from bottom", () => {
    const element = {
      scrollHeight: 1000,
      scrollTop: 850,
      clientHeight: 100,
    } as HTMLElement;

    expect(getChatDistanceFromBottom(element)).toBe(50);
  });

  it("treats scroll position within threshold as near bottom", () => {
    const nearBottom = {
      scrollHeight: 500,
      scrollTop: 400,
      clientHeight: 100,
    } as HTMLElement;

    expect(isNearChatBottom(nearBottom)).toBe(true);
    expect(
      isNearChatBottom(nearBottom, CHAT_NEAR_BOTTOM_THRESHOLD_PX),
    ).toBe(true);
  });

  it("adjusts scrollTop by prepended content height", () => {
    expect(getScrollTopAfterPrepend(1000, 120, 1600)).toBe(720);
    expect(getScrollTopAfterPrepend(1000, 120, 900)).toBe(120);
  });

  it("treats scroll position above threshold as not near bottom", () => {
    const scrolledUp = {
      scrollHeight: 500,
      scrollTop: 200,
      clientHeight: 100,
    } as HTMLElement;

    expect(isNearChatBottom(scrolledUp)).toBe(false);
  });
});
