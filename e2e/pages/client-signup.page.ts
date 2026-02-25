import type { Locator, Page } from "@playwright/test";

export class ClientSignupPage {
  readonly page: Page;
  readonly heading: Locator;

  // Step 0
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly continueButton: Locator;

  // Step 1
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly togglePasswordButton: Locator;
  readonly toggleConfirmPasswordButton: Locator;
  readonly backButton: Locator;

  // Step 2
  readonly termsCheckbox: Locator;
  readonly createAccountButton: Locator;

  // Common
  readonly loginLink: Locator;
  readonly logo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /Criar conta como Cliente|Cadastro realizado/ });

    // Step 0
    this.fullNameInput = page.locator("#fullName");
    this.emailInput = page.locator("#email");
    this.continueButton = page.getByRole("button", { name: "Continuar" });

    // Step 1
    this.passwordInput = page.locator("#password");
    this.confirmPasswordInput = page.locator("#confirmPassword");
    this.togglePasswordButton = page.locator("#password ~ button, #password + div button").first();
    this.toggleConfirmPasswordButton = page.locator("#confirmPassword ~ button, #confirmPassword + div button").first();
    this.backButton = page.getByRole("button", { name: "Voltar" });

    // Step 2
    this.termsCheckbox = page.locator("#terms");
    this.createAccountButton = page.getByRole("button", { name: /Criar minha conta|Criando/ });

    // Common
    this.loginLink = page.getByRole("link", { name: /Faça login|Fazer login/ });
    this.logo = page.getByAltText("Renovi");
  }

  async goto() {
    await this.page.goto("/cadastro/cliente");
  }

  // Step 0 helpers
  async fillStep0(fullName: string, email: string) {
    await this.fullNameInput.fill(fullName);
    await this.emailInput.fill(email);
  }

  async advanceToStep1(fullName: string, email: string) {
    await this.fillStep0(fullName, email);
    await this.continueButton.click();
  }

  // Step 1 helpers
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

  // Step 2 helpers
  async acceptTermsAndSubmit() {
    await this.termsCheckbox.click();
    await this.createAccountButton.click();
  }

  async completeSignup(
    fullName: string,
    email: string,
    password: string,
    confirmPassword: string
  ) {
    await this.advanceToStep2(fullName, email, password, confirmPassword);
    await this.termsCheckbox.waitFor({ state: "visible" });
    await this.acceptTermsAndSubmit();
  }

  // Locators for assertions
  getStepIndicator(stepNumber: number) {
    return this.page.locator(
      `.rounded-full:has-text("${stepNumber}")`
    );
  }

  getPasswordStrengthLabel() {
    return this.page.getByText(
      /Muito fraca|Fraca|Média|Forte|Muito forte/
    );
  }

  getPasswordRequirement(label: string) {
    return this.page.getByText(label, { exact: false });
  }

  getSuccessMessage() {
    return this.page.getByText("Cadastro realizado com sucesso!");
  }

  getConfirmationEmail(email: string) {
    return this.page.getByText(email);
  }

  getFieldError() {
    return this.page.locator(".text-red-400").first();
  }

  getReviewName() {
    return this.page.locator(".bg-white\\/5").last().getByText(/.*/, { exact: false });
  }
}
