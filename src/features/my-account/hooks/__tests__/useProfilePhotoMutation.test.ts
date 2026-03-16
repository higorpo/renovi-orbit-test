import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import {
  useUploadProfilePhoto,
  useRemoveProfilePhoto,
} from "../useProfilePhotoMutation";
import { toast } from "sonner";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
  profileApi: { updateProfile: vi.fn() },
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {},
}));

vi.mock("../../api/profileImageStorage.api", () => ({
  uploadProfileImage: vi.fn(),
  removeProfileImageFromStorage: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const profileApi = await import("@/features/auth").then((m) => m.profileApi);
const uploadProfileImage = vi.mocked(
  await import("../../api/profileImageStorage.api").then((m) => m.uploadProfileImage)
);
const removeProfileImageFromStorage = vi.mocked(
  await import("../../api/profileImageStorage.api").then(
    (m) => m.removeProfileImageFromStorage
  )
);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useUploadProfilePhoto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "user-1", email: "u@e.com" },
      profile: null,
    } as ReturnType<typeof useAuth>);
    uploadProfileImage.mockResolvedValue({ path: "users/user-1/profile/avatar.jpg", error: null });
    vi.mocked(profileApi.updateProfile).mockResolvedValue({ error: null });
  });

  it("returns uploadPhoto, uploadPhotoAsync and isUploading", () => {
    const { result } = renderHook(() => useUploadProfilePhoto(), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.uploadPhoto).toBe("function");
    expect(typeof result.current.uploadPhotoAsync).toBe("function");
    expect(result.current.isUploading).toBe(false);
  });

  it("uploads file, updates profile and shows success toast", async () => {
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    const { result } = renderHook(() => useUploadProfilePhoto(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.uploadPhotoAsync(file);
    });

    expect(uploadProfileImage).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      file
    );
    expect(profileApi.updateProfile).toHaveBeenCalledWith("user-1", {
      profile_image_path: "users/user-1/profile/avatar.jpg",
    });
    expect(toast.success).toHaveBeenCalledWith("Foto atualizada com sucesso.");
  });

  it("shows error toast when not authenticated", async () => {
    useAuth.mockReturnValue({
      user: null,
      profile: null,
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useUploadProfilePhoto(), {
      wrapper: createWrapper(),
    });
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });

    await act(async () => {
      try {
        await result.current.uploadPhotoAsync(file);
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(uploadProfileImage).not.toHaveBeenCalled();
  });

  it("shows error toast when uploadProfileImage returns error", async () => {
    uploadProfileImage.mockResolvedValue({ path: null, error: "File too large" });

    const { result } = renderHook(() => useUploadProfilePhoto(), {
      wrapper: createWrapper(),
    });
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });

    await act(async () => {
      try {
        await result.current.uploadPhotoAsync(file);
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("File too large");
    });
  });
});

describe("useRemoveProfilePhoto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "user-1", email: "u@e.com" },
      profile: null,
    } as ReturnType<typeof useAuth>);
    removeProfileImageFromStorage.mockResolvedValue({ error: null });
    vi.mocked(profileApi.updateProfile).mockResolvedValue({ error: null });
  });

  it("returns removePhoto, removePhotoAsync and isRemoving", () => {
    const { result } = renderHook(() => useRemoveProfilePhoto(), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.removePhoto).toBe("function");
    expect(typeof result.current.removePhotoAsync).toBe("function");
    expect(result.current.isRemoving).toBe(false);
  });

  it("removes from storage, clears profile path and shows success toast", async () => {
    const { result } = renderHook(() => useRemoveProfilePhoto(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.removePhotoAsync("users/user-1/profile/avatar.jpg");
    });

    expect(removeProfileImageFromStorage).toHaveBeenCalledWith(
      expect.anything(),
      "users/user-1/profile/avatar.jpg"
    );
    expect(profileApi.updateProfile).toHaveBeenCalledWith("user-1", {
      profile_image_path: null,
    });
    expect(toast.success).toHaveBeenCalledWith("Foto removida.");
  });

  it("shows error toast when remove fails", async () => {
    removeProfileImageFromStorage.mockResolvedValue({ error: "Storage error" });

    const { result } = renderHook(() => useRemoveProfilePhoto(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.removePhotoAsync("path");
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Não foi possível remover a foto.");
    });
  });
});
