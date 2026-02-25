import type { Locator, Page } from "@playwright/test";

export class ProviderSignupPage {
  readonly page: Page;
  readonly heading: Locator;

  // Step 0
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly continueButton: Locator;

  // Step 1
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly backButton: Locator;

  // Step 2
  readonly termsCheckbox: Locator;
  readonly createAccountButton: Locator;

  // Common
  readonly loginLink: Locator;
  readonly logo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", {
      name: /Criar conta como Profissional|Cadastro realizado/,
    });

    // Step 0
    this.fullNameInput = page.locator("#fullName");
    this.emailInput = page.locator("#email");
    this.continueButton = page.getByRole("button", { name: "Continuar" });

    // Step 1
    this.passwordInput = page.locator("#password");
    this.confirmPasswordInput = page.locator("#confirmPassword");
    this.backButton = page.getByRole("button", { name: "Voltar" });

    // Step 2
    this.termsCheckbox = page.locator("#terms");
    this.createAccountButton = page.getByRole("button", {
      name: /Criar minha conta|Criando/,
    });

    // Common
    this.loginLink = page.getByRole("link", { name: /Faça login|Fazer login/ });
    this.logo = page.getByAltText("Renovi");
  }

  async goto() {
    await this.page.goto("/cadastro/profissional");
  }

  async fillStep0(fullName: string, email: string) {
    await this.fullNameInput.fill(fullName);
    await this.emailInput.fill(email);
  }

  async advanceToStep1(fullName: string, email: string) {
    await this.fillStep0(fullName, email);
    await this.continueButton.click();
  }

  async fillStep1(password: string, confirmPassword: string) {
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
  }

  async advanceToStep2(
    fullName: string,
    email: string,
    password: string,
    confirmPassword: string
  ) {
    await this.advanceToStep1(fullName, email);
    await this.passwordInput.waitFor({ state: "visible" });
    await this.fillStep1(password, confirmPassword);
    await this.continueButton.click();
  }

  async completeSignup(
    fullName: string,
    email: string,
    password: string,
    confirmPassword: string
  ) {
    await this.advanceToStep2(fullName, email, password, confirmPassword);
    await this.termsCheckbox.waitFor({ state: "visible" });
    await this.termsCheckbox.click();
    await this.createAccountButton.click();
  }

  getSuccessMessage() {
    return this.page.getByText("Cadastro realizado com sucesso!");
  }

  getFieldError() {
    return this.page.locator(".text-red-400").first();
  }
}
