import type { Locator, Page } from "@playwright/test";

export class ForgotPasswordPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly loginLink: Locator;
  readonly logo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Esqueceu sua senha?" });
    this.subtitle = page.getByText("Digite seu email para receber um link de redefinição");
    this.emailInput = page.locator("#email");
    this.submitButton = page.getByRole("button", {
      name: /Enviar link de redefinição|Enviando/,
    });
    this.loginLink = page.getByRole("link", { name: "Faça login" });
    this.logo = page.getByAltText("Prestway");
  }

  async goto() {
    await this.page.goto("/esqueceu-senha");
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async submit() {
    await this.submitButton.click();
  }

  async requestReset(email: string) {
    await this.fillEmail(email);
    await this.submit();
  }

  getSuccessHeading() {
    return this.page.getByText(/email.*enviado|verifique.*caixa|link.*redefinição/i);
  }

  getFieldError() {
    return this.page.locator(".text-red-400").first();
  }
}
