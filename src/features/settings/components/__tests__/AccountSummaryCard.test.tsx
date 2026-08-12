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

  it("renders full name without email", () => {
    render(<AccountSummaryCard fullName="Maria Silva" />);
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("renders fallback when fullName is empty", () => {
    render(<AccountSummaryCard fullName="" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders Cliente desde when createdAt is provided", () => {
    useProfileImageUrl.mockReturnValue({ url: "", isLoading: false });
    render(
      <AccountSummaryCard
        fullName="Maria"
        createdAt="2024-01-15T00:00:00Z"
      />
    );
    expect(screen.getByText(/Cliente desde/)).toBeInTheDocument();
  });

  it("renders initials in fallback when no photo URL", () => {
    render(<AccountSummaryCard fullName="Maria Silva" />);
    expect(screen.getByText("MS")).toBeInTheDocument();
  });

  it("shows Alterar foto button when onPhotoSelect is provided", () => {
    const onPhotoSelect = vi.fn();
    render(
      <AccountSummaryCard fullName="Maria" onPhotoSelect={onPhotoSelect} />
    );
    expect(screen.getByRole("button", { name: /Alterar foto/ })).toBeInTheDocument();
  });

  it("calls onPhotoSelect when valid file is selected", () => {
    const onPhotoSelect = vi.fn();
    render(
      <AccountSummaryCard fullName="Maria" onPhotoSelect={onPhotoSelect} />
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
      <AccountSummaryCard fullName="Maria" onPhotoSelect={onPhotoSelect} />
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
        profileImagePath="path"
        onPhotoRemove={vi.fn()}
        isRemoving
      />
    );
    expect(screen.getByRole("button", { name: /Remover foto/ })).toBeDisabled();
  });

  it("renders profile link and copy button when profileLink and onCopyProfileLink are provided", () => {
    const onCopyProfileLink = vi.fn();
    render(
      <AccountSummaryCard
        fullName="Maria"
        profileLink="https://example.com/p/maria"
        onCopyProfileLink={onCopyProfileLink}
      />
    );
    expect(screen.getByRole("link", { name: /Visualizar perfil/ })).toHaveAttribute("href", "https://example.com/p/maria");
    const copyBtn = screen.getByRole("button", { name: /Copiar link do perfil/ });
    fireEvent.click(copyBtn);
    expect(onCopyProfileLink).toHaveBeenCalled();
  });

  it("renders custom sinceLabel when provided", () => {
    render(
      <AccountSummaryCard
        fullName="Maria"
        createdAt="2024-06-01T00:00:00Z"
        sinceLabel="No ar desde"
      />
    );
    expect(screen.getByText(/No ar desde/)).toBeInTheDocument();
  });

  it("does not render since line when createdAt is not provided", () => {
    render(<AccountSummaryCard fullName="Maria" />);
    expect(screen.queryByText(/Cliente desde/)).not.toBeInTheDocument();
  });

  it("shows loading spinner in avatar fallback when isLoading and no url", () => {
    useProfileImageUrl.mockReturnValue({ url: "", isLoading: true });
    render(<AccountSummaryCard fullName="Maria" />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("does not call onPhotoSelect when file input change has no files", () => {
    const onPhotoSelect = vi.fn();
    render(
      <AccountSummaryCard fullName="Maria" onPhotoSelect={onPhotoSelect} />
    );
    const input = screen.getByLabelText(/Selecionar foto/);
    fireEvent.change(input, { target: { files: [] } });
    expect(onPhotoSelect).not.toHaveBeenCalled();
  });

  it("does not show photo actions when onPhotoSelect and onPhotoRemove are not provided", () => {
    render(
      <AccountSummaryCard fullName="Maria" profileImagePath="path" />
    );
    expect(screen.queryByRole("button", { name: /Alterar foto/ })).not.toBeInTheDocument();
  });

  it("renders flush on the page floor in stack layout", () => {
    const { container } = render(
      <AccountSummaryCard layout="stack" fullName="Maria Silva" />,
    );
    const section = container.querySelector("section");
    expect(section?.className).not.toMatch(/bg-canvas/);
    expect(section?.className).not.toMatch(/border-border/);
    expect(section?.className).not.toMatch(/shadow-sm/);
  });
});

describe("AccountSummaryCardSkeleton", () => {
  it("renders skeleton placeholders", () => {
    render(<AccountSummaryCardSkeleton />);
    const skeletons = document.querySelectorAll("[class*='animate-pulse']");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders card structure with skeletons", () => {
    const { container } = render(<AccountSummaryCardSkeleton />);
    expect(container.querySelector(".rounded-full")).toBeInTheDocument();
  });
});
