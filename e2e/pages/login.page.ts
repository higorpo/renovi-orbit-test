import type { Locator, Page } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly togglePasswordButton: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly forgotPasswordLink: Locator;
  readonly clientSignupLink: Locator;
  readonly providerSignupLink: Locator;
  readonly logo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Bem-vindo de volta" });
    this.subtitle = page.getByText("Acesse sua conta para gerenciar seus serviços");
    this.emailInput = page.locator("#email");
    this.passwordInput = page.locator("#password");
    this.submitButton = page.getByRole("button", { name: /Entrar na minha conta|Entrando/ });
    this.togglePasswordButton = page.getByRole("button", { name: /Mostrar senha|Ocultar senha/ });
    this.rememberMeCheckbox = page.locator("#remember-me");
    this.forgotPasswordLink = page.getByRole("link", { name: "Esqueceu a senha?" });
    this.clientSignupLink = page.getByRole("link", { name: /Sou Cliente/ });
    this.providerSignupLink = page.getByRole("link", { name: /Sou Profissional/ });
    this.logo = page.getByAltText("Prestway");
  }

  async goto() {
    await this.page.goto("/login");
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  getValidationError(fieldName: string) {
    return this.page.locator(`#${fieldName} ~ p, #${fieldName} + p`).first();
  }

  getErrorMessage() {
    return this.page.locator(".text-red-400").first();
  }
}
