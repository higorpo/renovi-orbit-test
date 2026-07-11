// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceRequestContractedChatButton } from "../ServiceRequestContractedChatButton";

const navigateMock = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderButton(
  props: Partial<React.ComponentProps<typeof ServiceRequestContractedChatButton>> = {},
) {
  return render(
    <MemoryRouter>
      <ServiceRequestContractedChatButton chatId="chat-1" {...props} />
    </MemoryRouter>,
  );
}

describe("ServiceRequestContractedChatButton", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("navigates to the conversation when chat id is present", () => {
    renderButton({ providerDisplayName: "João" });

    fireEvent.click(screen.getByRole("button", { name: /Ver conversa com João/ }));

    expect(navigateMock).toHaveBeenCalledWith("/dashboard/chats/chat-1");
  });

  it("uses the default label and stays disabled without a chat id", () => {
    renderButton({ chatId: null });

    const button = screen.getByRole("button", { name: /Ver conversa com prestador/ });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
