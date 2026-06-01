import { expect, type Locator, type Page } from "@playwright/test";
import { E2E_CHAT_ID } from "../mocks/chats.mock";

export class ChatsPage {
  constructor(readonly page: Page) {}

  async gotoList() {
    await this.page.goto("/chats");
  }

  async gotoConversation(chatId = E2E_CHAT_ID) {
    await this.page.goto(`/chats/${chatId}`);
  }

  get listHeading() {
    return this.page.getByRole("heading", { name: "Conversas" });
  }

  get conversationListItem() {
    return this.page.getByRole("button", { name: /Conversa com/i });
  }

  get timeline() {
    return this.page.getByLabel("Mensagens da conversa");
  }

  get messageInput() {
    return this.page.getByPlaceholder("Escreva uma mensagem…");
  }

  get sendButton() {
    return this.page.getByRole("button", { name: "Enviar mensagem" });
  }

  get composerFooter() {
    return this.page.locator("footer").filter({ has: this.sendButton });
  }

  proposalCardButton(name: string | RegExp): Locator {
    return this.page.getByRole("button", { name });
  }

  async openFirstConversationFromList() {
    await this.conversationListItem.first().click();
    await this.timeline.waitFor({ state: "visible", timeout: 15_000 });
  }

  async sendMessage(text: string) {
    await this.messageInput.fill(text);
    await expect(this.sendButton).toBeEnabled({ timeout: 10_000 });
    await this.sendButton.click();
  }

  async expandProposalCard() {
    await this.page.getByRole("button", { name: /ver detalhes|ocultar detalhes/i }).first().click();
  }

  async openAcceptProposalDialog() {
    await this.proposalCardButton("Aceitar").click();
    await this.page.getByRole("heading", { name: "Aceitar proposta" }).waitFor({ state: "visible" });
  }

  async selectFirstSlotAndAccept() {
    await this.page.getByRole("radio").first().check();
    await this.page.getByRole("button", { name: "Confirmar aceite" }).click();
  }
}
