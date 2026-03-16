import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AccountSummaryCard,
  AccountSummaryCardSkeleton,
} from "../AccountSummaryCard";

vi.mock("../../hooks/useProfileImageUrl", () => ({
  useProfileImageUrl: vi.fn(),
}));

vi.mock("../../api/profileImageStorage.api", () => ({
  validateProfileImageFile: vi.fn(() => null),
}));

const useProfileImageUrl = vi.mocked(
  await import("../../hooks/useProfileImageUrl").then((m) => m.useProfileImageUrl)
);
const validateProfileImageFile = vi.mocked(
  await import("../../api/profileImageStorage.api").then((m) => m.validateProfileImageFile)
);

describe("AccountSummaryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProfileImageUrl.mockReturnValue({ url: "", isLoading: false });
  });

  it("renders full name and email", () => {
    render(
      <AccountSummaryCard
        fullName="Maria Silva"
        email="maria@example.com"
      />
    );
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
  });

  it("renders fallback when fullName or email empty", () => {
    render(
      <AccountSummaryCard fullName="" email="" />
    );
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Cliente desde when createdAt is provided", () => {
    useProfileImageUrl.mockReturnValue({ url: "", isLoading: false });
    render(
      <AccountSummaryCard
        fullName="Maria"
        email="m@e.com"
        createdAt="2024-01-15T00:00:00Z"
      />
    );
    expect(screen.getByText(/Cliente desde/)).toBeInTheDocument();
  });

  it("renders initials in fallback when no photo URL", () => {
    render(
      <AccountSummaryCard fullName="Maria Silva" email="m@e.com" />
    );
    expect(screen.getByText("MS")).toBeInTheDocument();
  });

  it("shows Alterar foto button when onPhotoSelect is provided", () => {
    const onPhotoSelect = vi.fn();
    render(
      <AccountSummaryCard
        fullName="Maria"
        email="m@e.com"
        onPhotoSelect={onPhotoSelect}
      />
    );
    expect(screen.getByRole("button", { name: /Alterar foto/ })).toBeInTheDocument();
  });

  it("calls onPhotoSelect when valid file is selected", () => {
    const onPhotoSelect = vi.fn();
    render(
      <AccountSummaryCard
        fullName="Maria"
        email="m@e.com"
        onPhotoSelect={onPhotoSelect}
      />
    );
    const input = screen.getByLabelText(/Selecionar foto/);
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    fireEvent.change(input, { target: { files: [file] } });
    expect(validateProfileImageFile).toHaveBeenCalledWith(file);
    expect(onPhotoSelect).toHaveBeenCalledWith(file);
  });

  it("does not call onPhotoSelect when validation fails", () => {
    validateProfileImageFile.mockReturnValue("Formato não permitido.");
    const onPhotoSelect = vi.fn();
    render(
      <AccountSummaryCard
        fullName="Maria"
        email="m@e.com"
        onPhotoSelect={onPhotoSelect}
      />
    );
    const input = screen.getByLabelText(/Selecionar foto/);
    const file = new File(["x"], "photo.gif", { type: "image/gif" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPhotoSelect).not.toHaveBeenCalled();
  });

  it("shows Remover button when onPhotoRemove and profileImagePath are provided", () => {
    useProfileImageUrl.mockReturnValue({ url: "https://example.com/photo.jpg", isLoading: false });
    const onPhotoRemove = vi.fn();
    render(
      <AccountSummaryCard
        fullName="Maria"
        email="m@e.com"
        profileImagePath="users/1/profile/avatar.jpg"
        onPhotoRemove={onPhotoRemove}
      />
    );
    expect(screen.getByRole("button", { name: /Remover foto/ })).toBeInTheDocument();
  });

  it("calls onPhotoRemove when Remover foto is clicked", () => {
    useProfileImageUrl.mockReturnValue({ url: "https://example.com/photo.jpg", isLoading: false });
    const onPhotoRemove = vi.fn();
    render(
      <AccountSummaryCard
        fullName="Maria"
        email="m@e.com"
        profileImagePath="path"
        onPhotoRemove={onPhotoRemove}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Remover foto/ }));
    expect(onPhotoRemove).toHaveBeenCalled();
  });

  it("disables photo buttons when isUploading", () => {
    render(
      <AccountSummaryCard
        fullName="Maria"
        email="m@e.com"
        onPhotoSelect={vi.fn()}
        isUploading
      />
    );
    expect(screen.getByRole("button", { name: /Alterar foto/ })).toBeDisabled();
  });

  it("disables photo buttons when isRemoving", () => {
    useProfileImageUrl.mockReturnValue({ url: "https://u", isLoading: false });
    render(
      <AccountSummaryCard
        fullName="Maria"
        email="m@e.com"
        profileImagePath="path"
        onPhotoRemove={vi.fn()}
        isRemoving
      />
    );
    expect(screen.getByRole("button", { name: /Remover foto/ })).toBeDisabled();
  });
});

describe("AccountSummaryCardSkeleton", () => {
  it("renders skeleton placeholders", () => {
    render(<AccountSummaryCardSkeleton />);
    const skeletons = document.querySelectorAll("[class*='animate-pulse']");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });
});
