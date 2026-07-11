// @vitest-environment happy-dom
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useChatAudioPermission } from "../useChatAudioPermission";

const isNativePlatformMock = vi.hoisted(() => vi.fn(() => false));
const openAppSettingsMock = vi.hoisted(() => vi.fn(async () => true));

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
  openAppSettings: (...args: unknown[]) => openAppSettingsMock(...args),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatformMock(),
  },
}));

import {
  getAudioRecordingPermissionStatus,
  requestAudioRecordingPermission,
  canRequestAudioRecordingPermission,
  isAudioRecordingPermissionBlocked,
} from "@/lib/capacitor/audioPermission";
import { toast } from "sonner";

describe("useChatAudioPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativePlatformMock.mockReturnValue(false);
    openAppSettingsMock.mockResolvedValue(true);
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

  it("toasts when the device does not support audio recording", async () => {
    vi.mocked(getAudioRecordingPermissionStatus).mockResolvedValue("unsupported");

    const { result } = renderHook(() => useChatAudioPermission());

    await act(async () => {
      await result.current.onMicButtonPress();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Seu dispositivo não suporta gravação de áudio.",
    );
    expect(result.current.recordingSheetOpen).toBe(false);
  });

  it("opens the recording sheet after the user grants permission", async () => {
    vi.mocked(requestAudioRecordingPermission).mockResolvedValue("granted");

    const { result } = renderHook(() => useChatAudioPermission());

    await act(async () => {
      await result.current.acceptAndRequestPermission();
    });

    expect(result.current.recordingSheetOpen).toBe(true);
    expect(result.current.requesting).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
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

  it("dismisses dialogs and closes the recording sheet", () => {
    const { result } = renderHook(() => useChatAudioPermission());

    act(() => {
      result.current.setPreDialogOpen(true);
      result.current.setBlockedDialogOpen(true);
    });
    act(() => {
      result.current.dismissPreDialog();
      result.current.dismissBlockedDialog();
    });

    expect(result.current.preDialogOpen).toBe(false);
    expect(result.current.blockedDialogOpen).toBe(false);

    act(() => {
      result.current.closeRecordingSheet();
    });
    expect(result.current.recordingSheetOpen).toBe(false);
  });

  it("guides web users to browser settings", async () => {
    const { result } = renderHook(() => useChatAudioPermission());

    await act(async () => {
      await result.current.openSettings();
    });

    expect(toast.message).toHaveBeenCalledWith(
      expect.stringMatching(/configurações do site/i),
    );
    expect(openAppSettingsMock).not.toHaveBeenCalled();
  });

  it("opens native settings and toasts when that fails", async () => {
    isNativePlatformMock.mockReturnValue(true);
    openAppSettingsMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { result } = renderHook(() => useChatAudioPermission());

    await act(async () => {
      await result.current.openSettings();
    });
    expect(openAppSettingsMock).toHaveBeenCalledOnce();
    expect(toast.error).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.openSettings();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível abrir as configurações automaticamente.",
    );
  });

  it("closes pre-dialog before requesting system permission", async () => {
    vi.mocked(requestAudioRecordingPermission).mockResolvedValue("granted");
    const { result } = renderHook(() => useChatAudioPermission());

    act(() => {
      result.current.setPreDialogOpen(true);
    });
    expect(result.current.preDialogOpen).toBe(true);

    await act(async () => {
      await result.current.acceptAndRequestPermission();
    });

    expect(result.current.preDialogOpen).toBe(false);
    expect(result.current.recordingSheetOpen).toBe(true);
  });

  it("toasts denial without blocked dialog when post-request status is not blocked", async () => {
    vi.mocked(requestAudioRecordingPermission).mockResolvedValue("denied");
    vi.mocked(getAudioRecordingPermissionStatus).mockResolvedValue("prompt");
    vi.mocked(isAudioRecordingPermissionBlocked).mockReturnValue(false);

    const { result } = renderHook(() => useChatAudioPermission());

    await act(async () => {
      await result.current.acceptAndRequestPermission();
    });

    expect(toast.error).toHaveBeenCalled();
    expect(result.current.blockedDialogOpen).toBe(false);
  });

  it("no-ops mic press for non-prompt non-blocked non-granted status", async () => {
    vi.mocked(getAudioRecordingPermissionStatus).mockResolvedValue("prompt-with-rationale" as never);
    vi.mocked(isAudioRecordingPermissionBlocked).mockReturnValue(false);
    vi.mocked(canRequestAudioRecordingPermission).mockReturnValue(false);

    const { result } = renderHook(() => useChatAudioPermission());

    await act(async () => {
      await result.current.onMicButtonPress();
    });

    expect(result.current.preDialogOpen).toBe(false);
    expect(result.current.blockedDialogOpen).toBe(false);
    expect(result.current.recordingSheetOpen).toBe(false);
  });

  it("sets requesting true during the permission flow", async () => {
    let resolveRequest!: (value: "granted") => void;
    vi.mocked(requestAudioRecordingPermission).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { result } = renderHook(() => useChatAudioPermission());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.acceptAndRequestPermission();
    });

    await waitFor(() => expect(result.current.requesting).toBe(true));

    await act(async () => {
      resolveRequest("granted");
      await pending;
    });

    expect(result.current.requesting).toBe(false);
  });
});
