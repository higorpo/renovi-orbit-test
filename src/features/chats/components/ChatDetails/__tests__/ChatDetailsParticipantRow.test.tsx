// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatDetailsParticipantRow } from "../ChatDetailsParticipantRow";

const usePublicProfileImageUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/provider-profile/hooks/usePublicProfileImageUrl", () => ({
  usePublicProfileImageUrl: (...args: unknown[]) => usePublicProfileImageUrlMock(...args),
}));

describe("ChatDetailsParticipantRow", () => {
  it("shows initials and marks the current user", () => {
    usePublicProfileImageUrlMock.mockReturnValue({ url: null, isLoading: false });

    render(
      <ChatDetailsParticipantRow
        participant={{
          id: "u1",
          fullName: "Maria Silva",
          role: "client",
          profileImagePath: null,
          isCurrentUser: true,
        }}
      />,
    );

    expect(screen.getByText("Maria Silva (você)")).toBeTruthy();
    expect(screen.getByText("Cliente")).toBeTruthy();
    expect(screen.getByText("MS")).toBeTruthy();
  });

  it("renders the profile image when a signed url is available", () => {
    usePublicProfileImageUrlMock.mockReturnValue({
      url: "https://cdn.example/avatar.jpg",
      isLoading: false,
    });

    const { container } = render(
      <ChatDetailsParticipantRow
        participant={{
          id: "u2",
          fullName: "João Prestador",
          role: "provider",
          profileImagePath: "profiles/u2.jpg",
          isCurrentUser: false,
        }}
      />,
    );

    expect(screen.getByText("João Prestador")).toBeTruthy();
    expect(screen.getByText("Prestador")).toBeTruthy();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/avatar.jpg",
    );
  });
});
