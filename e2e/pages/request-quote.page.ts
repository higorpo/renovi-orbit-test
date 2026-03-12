import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/**
 * Page Object for the Request Quote flow (/pedir-orcamento).
 * Supports both guest (5 steps) and logged-in (4 steps) flows.
 * Uses real Supabase API; locators are stable across desktop and mobile.
 */
export class RequestQuotePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(queryParams?: { serviceSlug?: string }) {
    const url = queryParams?.serviceSlug
      ? `/pedir-orcamento?serviceSlug=${encodeURIComponent(queryParams.serviceSlug)}`
      : "/pedir-orcamento";
    await this.page.goto(url);
  }

  // ─── Step indicator (desktop: stepper; mobile: "Etapa X de Y") ─────────────
  getStepIndicator() {
    return this.page.getByText(/Etapa \d+ de \d+/);
  }

  getMobileProgressBar() {
    return this.page.locator(".h-2.bg-white\\/20.rounded-full");
  }

  // ─── Step 1: Service selection ─────────────────────────────────────────────
  getStep1Heading() {
    return this.page.getByRole("heading", { name: "Escolha o tipo de serviço" });
  }

  getStep1Title() {
    return this.page.getByRole("heading", {
      name: /Contrate profissionais verificados/,
    });
  }

  getServicesLoading() {
    return this.page.getByText("Carregando serviços...");
  }

  getServicesEmpty() {
    return this.page.getByText("Nenhum serviço disponível no momento.");
  }

  /** First service card (button with an h3 title). Use after services have loaded. */
  getFirstServiceCard() {
    return this.page.locator("button").filter({ has: this.page.locator("h3") }).first();
  }

  /** Service card by visible title (partial match). */
  getServiceCardByTitle(title: string | RegExp) {
    return this.page.locator("button").filter({ has: this.page.getByRole("heading", { name: title, level: 3 }) });
  }

  getStep1Hint() {
    return this.page.getByText(/Selecione um serviço para continuar/);
  }

  // ─── Main wizard navigation (steps 3–5) ────────────────────────────────────
  getBackButton() {
    return this.page.getByRole("button", { name: /Voltar/ });
  }

  getNextButton() {
    return this.page.getByRole("button", { name: /Próximo/ });
  }

  getSubmitOrderButton() {
    return this.page.getByRole("button", { name: /Enviar pedido/ });
  }

  // ─── Step 2: Dynamic form (details) ────────────────────────────────────────
  getStep2SectionTitle() {
    return this.page.getByRole("heading", {
      name: "Nos conte mais sobre o serviço",
    });
  }

  getFormNotConfiguredAlert() {
    return this.page.getByText("Formulário não configurado");
  }

  getDynamicFormCancelButton() {
    return this.page.getByRole("button", { name: "Cancelar" });
  }

  getDynamicFormBackButton() {
    return this.page.getByRole("button", { name: "Voltar" });
  }

  getDynamicFormNextButton() {
    return this.page.getByRole("button", { name: "Próximo" }).first();
  }

  getDynamicFormConcluirButton() {
    return this.page.getByRole("button", { name: "Concluir" });
  }

  // ─── Step 3: Description & photos ─────────────────────────────────────────
  getStep3SectionTitle() {
    return this.page.getByRole("heading", { name: "Descrição e Fotos" });
  }

  getDescriptionTextarea() {
    return this.page.getByPlaceholder(/A descrição será gerada automaticamente/);
  }

  getDescriptionLabel() {
    return this.page.getByText("Descrição do Serviço");
  }

  getGeneratingDescriptionMessage() {
    return this.page.getByText("Gerando descrição profissional...");
  }

  getPhotosDropzone() {
    return this.page.getByText("Clique ou arraste e solte fotos aqui");
  }

  getPhotosFileInput() {
    return this.page.locator('input[type="file"][accept="image/*"]');
  }

  // ─── Step 4: Address ─────────────────────────────────────────────────────
  getStep4Title() {
    return this.page.getByRole("heading", { name: "Endereço do serviço" });
  }

  getStep4ChoosePrompt() {
    return this.page.getByText("Escolha um endereço ou cadastre um novo.");
  }

  getNewAddressButton() {
    return this.page.getByRole("button", { name: "Cadastrar novo endereço" });
  }

  getBackToAddressesButton() {
    return this.page.getByRole("button", { name: "Voltar para meus endereços" });
  }

  getCepInput() {
    return this.page.getByPlaceholder("00000-000");
  }

  getStateSelectTrigger() {
    return this.page
      .getByText("Estado", { exact: true })
      .locator("..")
      .getByRole("combobox");
  }

  getCitySelectTrigger() {
    return this.page
      .getByText("Cidade", { exact: true })
      .locator("..")
      .getByRole("combobox");
  }

  getNeighborhoodSelectTrigger() {
    return this.page
      .getByText("Bairro", { exact: true })
      .locator("..")
      .getByRole("combobox");
  }

  getStreetInput() {
    return this.page
      .getByText("Rua", { exact: true })
      .locator("..")
      .getByRole("textbox");
  }

  getNumberInput() {
    return this.page
      .getByText("Número", { exact: true })
      .locator("..")
      .getByRole("textbox");
  }

  getComplementInput() {
    return this.page.getByPlaceholder("Apto, bloco, etc. (opcional)");
  }

  /** Select first available state (after opening the state dropdown). */
  async selectFirstState() {
    await this.getStateSelectTrigger().click();
    const firstOption = this.page.getByRole("option").first();
    await firstOption.waitFor({ state: "visible", timeout: 8000 });
    await firstOption.click();
  }

  /** Select first available city (state must be selected first). */
  async selectFirstCity() {
    await this.getCitySelectTrigger().click();
    const firstOption = this.page.getByRole("option").first();
    await firstOption.waitFor({ state: "visible", timeout: 8000 });
    await firstOption.click();
  }

  /** Select first available neighborhood (city must be selected first). */
  async selectFirstNeighborhood() {
    await this.getNeighborhoodSelectTrigger().click();
    const firstOption = this.page.getByRole("option").first();
    await firstOption.waitFor({ state: "visible", timeout: 8000 });
    await firstOption.click();
  }

  /** Fill address form (guest flow). Fills CEP, waits for state to be enabled, then selects state/city/neighborhood and street/number. */
  async fillNewAddress(options: {
    cep?: string;
    street: string;
    number: string;
    complement?: string;
  }) {
    const { cep = "01001-000", street, number, complement = "" } = options;
    await this.getCepInput().fill(cep);
    await this.page.waitForTimeout(2000);
    const stateTrigger = this.getStateSelectTrigger();
    await stateTrigger.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await expect(stateTrigger).toBeEnabled({ timeout: 10000 });
    await this.selectFirstState();
    await this.page.waitForTimeout(800);
    await this.selectFirstCity();
    await this.page.waitForTimeout(800);
    await this.selectFirstNeighborhood();
    await this.page.waitForTimeout(300);
    await this.getStreetInput().fill(street);
    await this.getNumberInput().fill(number);
    if (complement) {
      await this.getComplementInput().fill(complement);
    }
    await this.page.waitForTimeout(800);
    await expect(this.getNextButton()).toBeEnabled({ timeout: 15000 });
  }

  // ─── Step 5: Identity (guest only) ────────────────────────────────────────
  getStep5Title() {
    return this.page.getByRole("heading", { name: "Seus dados" });
  }

  getFirstNameInput() {
    return this.page.getByPlaceholder("Nome", { exact: true });
  }

  getLastNameInput() {
    return this.page.getByPlaceholder("Sobrenome", { exact: true });
  }

  getEmailInput() {
    return this.page.getByPlaceholder("seu@email.com", { exact: true });
  }

  getPasswordInput() {
    return this.page.locator('input[type="password"]').first();
  }

  getConfirmPasswordInput() {
    return this.page.locator('input[type="password"]').nth(1);
  }

  getTermsCheckbox() {
    return this.page.getByRole("checkbox", { name: /Li e aceito os/ });
  }

  getPasswordMismatchAlert() {
    return this.page.getByText("As senhas não coincidem.");
  }

  // ─── Confirm email screen (after guest submit) ─────────────────────────────
  getConfirmEmailHeading() {
    return this.page.getByRole("heading", {
      name: "Pedido de orçamento enviado com sucesso",
    });
  }

  getConfirmEmailMessage() {
    return this.page.getByText(
      "Agora é preciso confirmar seu e-mail para que profissionais possam ver e responder ao seu pedido."
    );
  }

  getConfirmEmailDisplay(email: string) {
    return this.page.getByText(email);
  }

  getGoToLoginLink() {
    return this.page.getByRole("link", { name: "Ir para o login" });
  }

  // ─── Draft restore dialog ────────────────────────────────────────────────
  getDraftDialog() {
    return this.page.getByRole("alertdialog");
  }

  getDraftDialogTitle() {
    return this.page.getByRole("heading", { name: "Continuar de onde parou?" });
  }

  getDraftContinueButton() {
    return this.page.getByRole("button", { name: "Continuar" });
  }

  getDraftDiscardButton() {
    return this.page.getByRole("button", { name: "Começar de novo" });
  }

  // ─── Toasts (Sonner renders in [data-sonner-toast] or similar) ─────────────
  getToast(message: string | RegExp) {
    return this.page.getByText(message);
  }

  getSuccessToast() {
    return this.page.getByText("Pedido enviado com sucesso!");
  }

  getToastSelectService() {
    return this.page.getByText("Selecione um serviço para continuar.");
  }

  getToastDescriptionRequired() {
    return this.page.getByText("Adicione uma descrição do serviço.");
  }

  getToastFillAddress() {
    return this.page.getByText("Preencha o endereço.");
  }

  getToastCepNotFound() {
    return this.page.getByText("O CEP digitado não existe.");
  }

  getToastRegionNotAvailable() {
    return this.page.getByText("A Renovi ainda não está disponível nessa localização.");
  }

  getToastSmartDescriptionError() {
    return this.page
      .getByText(
        "Não foi possível gerar a descrição automaticamente. Descreva o serviço manualmente."
      )
      .first();
  }

  getToastGenericError() {
    return this.page.getByText("Ocorreu um erro. Tente novamente.");
  }

  getToastSignupAlreadyRegistered() {
    return this.page.getByText("Este email já está cadastrado.");
  }

  // ─── Header / layout ─────────────────────────────────────────────────────
  getLogoLink() {
    return this.page.getByRole("link", { name: "Renovi" }).first();
  }

  getTrustBadgeTwoMin() {
    return this.page.getByText(/2 min/);
  }

  getTrustBadgePayment() {
    return this.page.getByText("Pagamento Protegido").first();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  /** Wait for step 1 to be ready (services loaded or empty/error state). */
  async waitForStep1Ready() {
    await Promise.race([
      this.getStep1Heading().waitFor({ state: "visible", timeout: 5000 }),
      this.getServicesLoading().waitFor({ state: "visible", timeout: 2000 }),
    ]).catch(() => {});
    await this.page.waitForTimeout(500);
    const loading = this.getServicesLoading();
    if (await loading.isVisible()) {
      await loading.waitFor({ state: "hidden", timeout: 15000 });
    }
  }

  /** Whether we are on the confirm-email screen (guest flow completed). */
  async isConfirmEmailScreenVisible() {
    return this.getConfirmEmailHeading().isVisible();
  }

  /**
   * Complete step 2 (dynamic form): click Próximo until Concluir appears, then Concluir.
   * Use only when the form has no required fields or they are already filled.
   * No-op if form is not configured. Returns true if step 3 (Descrição e Fotos) is reached.
   */
  async completeStep2ToStep3(): Promise<boolean> {
    const concluir = this.getDynamicFormConcluirButton();
    const next = this.getDynamicFormNextButton();
    for (let i = 0; i < 10; i++) {
      if ((await concluir.count()) > 0) {
        await concluir.click();
        await this.page.waitForTimeout(600);
        const step3Visible = await this.getStep3SectionTitle().isVisible();
        return step3Visible;
      }
      if ((await next.count()) === 0) return false;
      if (await next.isDisabled()) return false;
      await next.click();
      await this.page.waitForTimeout(400);
    }
    return false;
  }

  /**
   * Fills the step 2 form for "Instalação elétrica" (seed schema) and completes it to reach step 3.
   * Step 0: Nova instalação -> Residencial -> Média -> Próximo.
   * Step 1: Quantidade de pontos = 4, Precisa de aterramento = Sim -> Próximo.
   * Step 2: Concluir (observações optional).
   * Returns true if step 3 is reached. Call after selecting a service that uses this form.
   */
  async fillStep2ElectricalFormAndComplete(): Promise<boolean> {
    const next = this.getDynamicFormNextButton();
    const concluir = this.getDynamicFormConcluirButton();

    if ((await next.count()) === 0 && (await concluir.count()) === 0) {
      return false;
    }

    await this.page.waitForTimeout(500);

    const novaInstalacao = this.page.getByRole("radio", { name: "Nova instalação" });
    if (await novaInstalacao.isVisible()) {
      await novaInstalacao.click();
      await this.page.waitForTimeout(200);
    }
    const residencial = this.page.getByRole("radio", { name: "Residencial" });
    if (await residencial.isVisible()) {
      await residencial.click();
      await this.page.waitForTimeout(200);
    }
    const media = this.page.getByRole("radio", { name: "Média" });
    if (await media.isVisible()) {
      await media.click();
      await this.page.waitForTimeout(200);
    }
    if ((await next.count()) > 0 && !(await next.isDisabled())) {
      await next.click();
      await this.page.waitForTimeout(500);
    }

    const qtdPontos = this.page.getByLabel(/Quantidade de pontos ou circuitos/i);
    if (await qtdPontos.isVisible()) {
      await qtdPontos.fill("4");
      await this.page.waitForTimeout(200);
    }
    const aterramentoGroup = this.page.getByLabel(/Precisa de aterramento/i);
    if (await aterramentoGroup.isVisible()) {
      await aterramentoGroup.getByRole("radio", { name: "Sim" }).click();
      await this.page.waitForTimeout(200);
    } else {
      const simRadio = this.page.getByRole("radio", { name: "Sim" }).first();
      if (await simRadio.isVisible()) {
        await simRadio.click();
        await this.page.waitForTimeout(200);
      }
    }
    if ((await next.count()) > 0 && !(await next.isDisabled())) {
      await next.click();
      await this.page.waitForTimeout(500);
    }

    if ((await concluir.count()) > 0 && !(await concluir.isDisabled())) {
      await concluir.click();
      await this.page.waitForTimeout(600);
    } else if ((await next.count()) > 0 && !(await next.isDisabled())) {
      await next.click();
      await this.page.waitForTimeout(500);
      if ((await concluir.count()) > 0) {
        await concluir.click();
        await this.page.waitForTimeout(600);
      }
    }

    const step3Visible = await this.getStep3SectionTitle().isVisible();
    return step3Visible;
  }
}
