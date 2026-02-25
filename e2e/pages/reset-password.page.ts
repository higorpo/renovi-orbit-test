import type { Locator, Page } from "@playwright/test";

export class ResetPasswordPage {
  readonly page: Page;

  // Recovery mode (form visible)
  readonly heading: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly togglePasswordButton: Locator;
  readonly toggleConfirmPasswordButton: Locator;
  readonly loginLink: Locator;

  // Non-recovery mode
  readonly requestNewLinkButton: Locator;
  readonly nonRecoveryHeading: Locator;
  readonly nonRecoveryLoginLink: Locator;

  readonly logo: Locator;

  constructor(page: Page) {
    this.page = page;

    // Recovery mode
    this.heading = page.getByRole("heading", { name: "Crie uma nova senha" });
    this.passwordInput = page.locator("#password");
    this.confirmPasswordInput = page.locator("#confirmPassword");
    this.submitButton = page.getByRole("button", { name: /Redefinir senha|Salvando/ });
    this.togglePasswordButton = page.getByRole("button", { name: /Mostrar senha|Ocultar senha/ }).first();
    this.toggleConfirmPasswordButton = page.getByRole("button", { name: /Mostrar senha|Ocultar senha/ }).last();
    this.loginLink = page.getByRole("link", { name: "Fazer login" });

    // Non-recovery mode
    this.requestNewLinkButton = page.getByRole("link", { name: "Solicitar novo link" });
    this.nonRecoveryHeading = page.getByRole("heading", { name: "Link de redefinição" });
    this.nonRecoveryLoginLink = page.getByRole("link", { name: "Voltar para o login" });

    this.logo = page.getByAltText("Renovi");
  }

  async goto() {
    await this.page.goto("/recuperar-senha");
  }

  async fillPasswords(password: string, confirmPassword: string) {
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
  }

  async submitNewPassword(password: string, confirmPassword: string) {
    await this.fillPasswords(password, confirmPassword);
    await this.submitButton.click();
  }

  getPasswordStrengthLabel() {
    return this.page.getByText(/Muito fraca|Fraca|Média|Forte|Muito forte/);
  }

  getPasswordRequirement(label: string) {
    return this.page.getByText(label, { exact: false });
  }

  getFieldError() {
    return this.page.locator(".text-red-400").first();
  }
}
