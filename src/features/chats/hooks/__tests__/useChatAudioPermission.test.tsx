// @vitest-environment happy-dom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useChatAudioPermission } from "../useChatAudioPermission";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("@/lib/capacitor/audioPermission", () => ({
  getAudioRecordingPermissionStatus: vi.fn(),
  requestAudioRecordingPermission: vi.fn(),
  waitBeforeSystemPermissionPrompt: vi.fn(async () => undefined),
  canRequestAudioRecordingPermission: vi.fn((status: string) => status === "prompt"),
  isAudioRecordingPermissionBlocked: vi.fn((status: string) => status === "denied"),
}));

vi.mock("@/lib/capacitor/openAppSettings", () => ({
  openAppSettings: vi.fn(async () => true),
}));

import {
  getAudioRecordingPermissionStatus,
  requestAudioRecordingPermission,
} from "@/lib/capacitor/audioPermission";
import { toast } from "sonner";

describe("useChatAudioPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens recording sheet when permission is already granted", async () => {
    vi.mocked(getAudioRecordingPermissionStatus).mockResolvedValue("granted");

    const { result } = renderHook(() => useChatAudioPermission());

    await act(async () => {
      await result.current.onMicButtonPress();
    });

    expect(result.current.recordingSheetOpen).toBe(true);
    expect(result.current.preDialogOpen).toBe(false);
  });

  it("shows pre-dialog when permission is prompt", async () => {
    vi.mocked(getAudioRecordingPermissionStatus).mockResolvedValue("prompt");

    const { result } = renderHook(() => useChatAudioPermission());

    await act(async () => {
      await result.current.onMicButtonPress();
    });

    expect(result.current.preDialogOpen).toBe(true);
  });

  it("shows blocked dialog when permission is denied", async () => {
    vi.mocked(getAudioRecordingPermissionStatus).mockResolvedValue("denied");

    const { result } = renderHook(() => useChatAudioPermission());

    await act(async () => {
      await result.current.onMicButtonPress();
    });

    expect(result.current.blockedDialogOpen).toBe(true);
  });

  it("shows toast when permission request is denied", async () => {
    vi.mocked(requestAudioRecordingPermission).mockResolvedValue("denied");
    vi.mocked(getAudioRecordingPermissionStatus).mockResolvedValue("denied");

    const { result } = renderHook(() => useChatAudioPermission());

    await act(async () => {
      await result.current.acceptAndRequestPermission();
    });

    expect(toast.error).toHaveBeenCalled();
    expect(result.current.blockedDialogOpen).toBe(true);
  });
});
