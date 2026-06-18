import { expect, type Page } from "@playwright/test";
import {
  E2E_DISPATCH_STOPPED_CHAT_ID,
  E2E_DISPATCH_STOPPED_SR_ID,
  E2E_DISPATCH_STOPPED_SR_TITLE,
} from "../mocks/dispatch-stopped.mock";

export class ServiceDetailPage {
  private title: string;

  constructor(
    readonly page: Page,
    title: string = E2E_DISPATCH_STOPPED_SR_TITLE,
  ) {
    this.title = title;
  }

  async goto(
    serviceRequestId = E2E_DISPATCH_STOPPED_SR_ID,
    title?: string,
  ) {
    if (title) {
      this.title = title;
    }
    await this.page.goto(`/dashboard/services/${serviceRequestId}`);
  }

  get titleHeading() {
    return this.page.getByRole("heading", { name: this.title });
  }

  get editProposalButton() {
    return this.page.getByRole("button", { name: "Editar orçamento" });
  }

  get submitProposalButton() {
    return this.page.getByRole("button", { name: "Enviar orçamento" });
  }

  get initiateNegotiationButton() {
    return this.page.getByRole("button", {
      name: "Iniciar negociação com o cliente",
    });
  }

  async openProposalComposer() {
    await this.editProposalButton.click();
    await expect(this.page.getByRole("heading", { name: "Enviar orçamento" })).toBeVisible({
      timeout: 10_000,
    });
  }

  async submitProposalWithEdit() {
    await this.page
      .getByPlaceholder("Descreva como você vai executar o serviço, prazo estimado e diferenciais.")
      .fill("Escopo revisado após matching parado.");
    await this.submitProposalButton.click();
  }

  async initiateNegotiation() {
    await this.initiateNegotiationButton.click();
  }
}

export function serviceDetailPath(serviceRequestId = E2E_DISPATCH_STOPPED_SR_ID) {
  return `/dashboard/services/${serviceRequestId}`;
}

export function chatPath(chatId = E2E_DISPATCH_STOPPED_CHAT_ID) {
  return `/dashboard/chats/${chatId}`;
}
