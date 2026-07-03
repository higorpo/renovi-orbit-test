import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { ChatsPage } from "./chats.page";

export class PaymentsCheckoutPage extends ChatsPage {
  constructor(page: Page) {
    super(page);
  }

  async startPaymentCheckoutFromProposal() {
    await this.gotoConversation();
    await expect(this.timeline).toBeVisible({ timeout: 15_000 });
    await this.page.getByRole("button", { name: "Aceitar" }).click();
    await expect(this.page.getByRole("heading", { name: "Aceitar proposta" })).toBeVisible();
    await this.page.getByRole("radio").first().check();
    await this.page.getByRole("button", { name: "Continuar para pagamento" }).click();
    await expect(this.page.getByRole("heading", { name: "Pagamento" })).toBeVisible();
    await expect(this.page.getByTestId("checkout-stepper")).toBeVisible({ timeout: 15_000 });
  }

  async completeCpfStep(cpf = "39053344705") {
    await expect(this.page.getByTestId("checkout-step-cpf")).toBeVisible();
    await this.page.getByLabel("CPF").fill(cpf);
    await this.page.getByRole("button", { name: "Continuar" }).click();
  }

  async completeCardStep() {
    await expect(this.page.getByTestId("checkout-card-step")).toBeVisible({ timeout: 15_000 });
    await this.page.getByLabel("Número do cartão").fill("4970100000000048");
    await this.page.getByLabel("Mês").fill("12");
    await this.page.getByLabel("Ano").fill("2030");
    await this.page.getByLabel("CVV").fill("123");
    await this.page.getByLabel("Nome no cartão").fill("Maria E2E");
    await this.page.locator("#checkout-billing-street").fill("Rua Teste");
    await this.page.locator("#checkout-billing-number").fill("100");
    await this.page.locator("#checkout-billing-district").fill("Centro");
    await this.page.locator("#checkout-billing-city").fill("Joinville");
    await this.page.locator("#checkout-billing-state").fill("SC");
    await this.page.locator("#checkout-billing-zip").fill("89201420");
    await this.page.getByTestId("checkout-card-step").getByRole("button", { name: "Continuar" }).click();
  }

  async completeInstallmentStep() {
    await expect(this.page.getByText("Escolha o parcelamento")).toBeVisible({ timeout: 15_000 });
    await this.page.getByRole("radio").first().check();
    await this.page.getByRole("button", { name: "Continuar" }).click();
  }

  async confirmCheckout() {
    await expect(this.page.getByRole("heading", { name: "Confirme a contratação" })).toBeVisible({
      timeout: 15_000,
    });
    await this.page.getByRole("button", { name: "Confirmar contratação" }).click();
  }
}
