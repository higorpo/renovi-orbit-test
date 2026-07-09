import { expect, type Page } from "@playwright/test";
import {
  E2E_MANUAL_SR_ID,
  E2E_MANUAL_SR_TITLE,
} from "../mocks/payments-manual.mock";

export class PaymentsManualPage {
  constructor(readonly page: Page) {}

  async goto(serviceRequestId = E2E_MANUAL_SR_ID) {
    await this.page.goto(`/dashboard/services/${serviceRequestId}`);
    await expect(
      this.page.getByRole("heading", { name: E2E_MANUAL_SR_TITLE }),
    ).toBeVisible({ timeout: 15_000 });
  }

  get manualPaymentButton() {
    return this.page.getByRole("button", { name: "Efetuar Pagamento" });
  }

  async openManualPaymentDialog() {
    await this.manualPaymentButton.click();
    await expect(
      this.page.getByRole("heading", { name: "Efetuar pagamento" }),
    ).toBeVisible({ timeout: 10_000 });
  }

  /** @deprecated Prefer openManualPaymentDialog */
  async openManualPaymentModal() {
    await this.openManualPaymentDialog();
  }

  async selectCardAndInstallments() {
    await expect(this.page.getByText(/Escolha um cartão/i)).toBeVisible({
      timeout: 10_000,
    });

    await this.page.locator('label[for^="saved-card-"]').first().click();
    await this.page.getByRole("button", { name: "Continuar" }).click();

    await expect(this.page.getByText(/Escolha o parcelamento/i)).toBeVisible({
      timeout: 10_000,
    });

    await this.page.locator('label[for^="installment-"]').first().click();
    await this.page.getByRole("button", { name: "Continuar" }).click();

    await expect(
      this.page.getByRole("heading", { name: "Confirmar pagamento" }),
    ).toBeVisible({ timeout: 10_000 });
  }

  async confirmManualPayment() {
    const confirmButton = this.page.getByRole("button", { name: "Confirmar pagamento" });
    await expect(confirmButton).toBeEnabled({ timeout: 10_000 });
    await confirmButton.click();
  }

  async expectTerminalFailureState() {
    await expect(
      this.page.getByRole("heading", { name: "Pagamento não concluído" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText("Cartão recusado")).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: "Tentar com outro cartão" }),
    ).toBeVisible();
  }
}
