/**
 * CNS chat happy-path E2E (task 106).
 * Default: mocked Supabase RPCs. Set E2E_CNS_REAL_SUPABASE=1 to hit staging instead.
 */
import { test, expect } from "../fixtures/auth.fixture";
import {
  E2E_CHAT_ID,
  E2E_CLIENT_ID,
  E2E_PROVIDER_ID,
  installChatsMocks,
} from "../mocks/chats.mock";
import { ChatsPage } from "../pages/chats.page";

const useRealSupabase = process.env.E2E_CNS_REAL_SUPABASE === "1";

async function setupClientSession(
  seedSession: (overrides?: { id?: string; role?: string }) => Promise<void>,
  mockSupabaseAsUser: (
    user?: { id?: string; role?: string },
    profile?: { id?: string; role?: "client" | "provider" },
  ) => ReturnType<typeof import("../mocks/supabase.mock").installSupabaseMocks>,
  page: import("@playwright/test").Page,
  withPendingProposal = false,
) {
  if (useRealSupabase) return;

  await seedSession({ id: E2E_CLIENT_ID, role: "client" });
  await mockSupabaseAsUser(
    { id: E2E_CLIENT_ID, role: "client" },
    { id: E2E_CLIENT_ID, role: "client" },
  );
  await installChatsMocks(page, {
    viewerUserId: E2E_CLIENT_ID,
    viewerRole: "client",
    withPendingProposal,
  });
}

async function setupProviderSession(
  seedSession: (overrides?: { id?: string; role?: string }) => Promise<void>,
  mockSupabaseAsUser: (
    user?: { id?: string; role?: string },
    profile?: { id?: string; role?: "client" | "provider" },
  ) => ReturnType<typeof import("../mocks/supabase.mock").installSupabaseMocks>,
  page: import("@playwright/test").Page,
) {
  if (useRealSupabase) return;

  await seedSession({ id: E2E_PROVIDER_ID, role: "provider" });
  await mockSupabaseAsUser(
    { id: E2E_PROVIDER_ID, role: "provider" },
    { id: E2E_PROVIDER_ID, role: "provider" },
  );
  await installChatsMocks(page, {
    viewerUserId: E2E_PROVIDER_ID,
    viewerRole: "provider",
    withPendingProposal: false,
  });
}

test.describe("CNS chats — happy paths", () => {
  test.skip(useRealSupabase, "Set E2E_CNS_REAL_SUPABASE only when staging fixtures are configured.");

  test("client opens list, sends a text message", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    await setupClientSession(seedSession, mockSupabaseAsUser, page, false);
    const chats = new ChatsPage(page);

    await chats.gotoConversation();
    await expect(chats.timeline).toBeVisible({ timeout: 15_000 });
    await expect(chats.messageInput).toBeEnabled({ timeout: 15_000 });
    await chats.sendMessage("Mensagem de teste E2E");
    await expect(chats.timeline.getByText("Mensagem de teste E2E")).toBeVisible();
  });

  test("provider sends a text message in conversation", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    await setupProviderSession(seedSession, mockSupabaseAsUser, page);
    const chats = new ChatsPage(page);

    await chats.gotoConversation();
    await chats.sendMessage("Proposta em preparação");
    await expect(chats.timeline.getByText("Proposta em preparação")).toBeVisible();
  });

  test("client accepts proposal with slot picker", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    await setupClientSession(seedSession, mockSupabaseAsUser, page, true);
    const chats = new ChatsPage(page);

    await chats.gotoConversation(E2E_CHAT_ID);
    await expect(chats.timeline).toBeVisible();
    await chats.expandProposalCard();
    await expect(chats.page.getByText(/Pintura completa/i)).toBeVisible();
    await chats.openAcceptProposalDialog();
    await chats.selectFirstSlotAndAccept();
    await expect(chats.page.getByRole("heading", { name: "Aceitar proposta" })).toBeHidden({
      timeout: 10_000,
    });
  });

  test("composer remains visible when input is focused on mobile-safari", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-safari",
      "keyboard safe-area check targets mobile-safari project",
    );

    await setupClientSession(seedSession, mockSupabaseAsUser, page, false);
    const chats = new ChatsPage(page);
    await chats.gotoConversation();

    await chats.messageInput.focus();
    await expect(chats.composerFooter).toBeVisible();
    await expect(chats.sendButton).toBeVisible();
  });
});
