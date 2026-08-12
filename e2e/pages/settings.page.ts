import type { Locator, Page } from "@playwright/test";

/** Configurações hub (/dashboard/settings) — client and provider variants. */
export class SettingsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/dashboard/settings/personal-info");
  }

  getPageHeading() {
    // Desktop hub sidebar uses h1 "Configurações"; mobile stack uses section title.
    return this.page.getByRole("heading", {
      name: /Configurações|Informações pessoais/,
    });
  }

  getClientSubtitle() {
    return this.page.getByText(
      "Gerencie seus dados, endereços e preferências de privacidade"
    );
  }

  getProviderSubtitle() {
    return this.page.getByText(
      "Gerencie seus dados, identidade profissional e perfil público"
    );
  }

  getSummaryName() {
    return this.page.locator("aside h2").first();
  }

  getSinceLabelClient() {
    return this.page.getByText(/Cliente desde/);
  }

  getSinceLabelProvider() {
    return this.page.getByText(/No ar desde/);
  }

  getAlterarFotoButton() {
    return this.page.getByRole("button", { name: "Alterar foto" });
  }

  getRemoverFotoButton() {
    return this.page.getByRole("button", { name: "Remover foto" });
  }

  getPhotoFileInput() {
    return this.page.getByLabel("Selecionar foto");
  }

  getFullNameInput() {
    return this.page.locator("#account-full_name");
  }

  getEmailField() {
    return this.page.locator("#account-email");
  }

  getPhoneInput() {
    return this.page.locator("#account-phone");
  }

  /** Client: CPF in Dados pessoais */
  getCpfInput() {
    return this.page.locator("#account-cpf");
  }

  /** Form auto-save line only (Sonner also uses aria-live on the toast region). */
  getAutoSaveStatus() {
    return this.page
      .locator("p.text-muted-foreground")
      .filter({ hasText: /Salvando…|As alterações são salvas automaticamente\./ });
  }

  getSectionDadosPessoais() {
    return this.page.getByText("Dados pessoais").first();
  }

  getSectionContatoIdentidade() {
    return this.page.getByText("Contato").first();
  }

  getSectionEnderecos() {
    return this.page.getByText("Endereços").first();
  }

  getAdicionarEnderecoButton() {
    return this.page.getByRole("button", { name: "Adicionar endereço" });
  }

  getSectionPrivacidade() {
    return this.page.getByText("Privacidade e LGPD").first();
  }

  getFalarComDpoLink() {
    return this.page.getByRole("link", { name: "Falar com o DPO" });
  }

  getExportarDadosButton() {
    return this.page.getByRole("button", { name: "Exportar meus dados" });
  }

  /** Radix uses alertdialog; fallback to dialog if a11y tree differs. */
  getExportarAlertDialog(): Locator {
    return this.page
      .getByRole("alertdialog", { name: "Exportar meus dados" })
      .or(this.page.getByRole("dialog").filter({ hasText: /Exportar meus dados|portabilidade dos seus dados/i }));
  }

  getExportarDialogTitle() {
    return this.getExportarAlertDialog().getByRole("heading", { name: "Exportar meus dados" });
  }

  getExportarEntendiButton() {
    return this.getExportarAlertDialog().getByRole("button", { name: "Entendi" });
  }

  /** Prefer scoped getters (export / danger) when a specific dialog is open. */
  getEntendiButton() {
    return this.page.getByRole("button", { name: "Entendi" });
  }

  getSairDaContaButton() {
    return this.page.getByRole("button", { name: "Sair da conta" });
  }

  getLogoutAlertDialog(): Locator {
    return this.page
      .getByRole("alertdialog", { name: "Sair da conta" })
      .or(this.page.getByRole("dialog").filter({ hasText: /Sair da conta|desconectado da sua conta/i }));
  }

  getLogoutDialogTitle() {
    return this.getLogoutAlertDialog().getByRole("heading", { name: "Sair da conta" });
  }

  getLogoutConfirmButton() {
    return this.getLogoutAlertDialog().getByRole("button", { name: "Sair", exact: true });
  }

  getZonaPerigoSection() {
    return this.page.getByText("Zona de perigo").first();
  }

  getExcluirContaButton() {
    return this.page.getByRole("button", { name: "Excluir minha conta" });
  }

  getExcluirContaAlertDialog(): Locator {
    return this.page
      .getByRole("alertdialog", { name: "Excluir minha conta" })
      .or(this.page.getByRole("dialog").filter({ hasText: /Excluir minha conta|exclusão da sua conta/i }));
  }

  getExcluirContaDialogTitle() {
    return this.getExcluirContaAlertDialog().getByRole("heading", { name: "Excluir minha conta" });
  }

  getExcluirContaEntendiButton() {
    return this.getExcluirContaAlertDialog().getByRole("button", { name: "Entendi" });
  }

  /** Provider: summary card */
  getVisualizarPerfilSummary() {
    return this.page.locator("aside").getByRole("link", { name: "Visualizar perfil" });
  }

  getCopiarLinkSummary() {
    return this.page.locator("aside").getByRole("button", { name: "Copiar link do perfil" });
  }

  /** Provider: phone in Contato card (no #account-phone id). */
  getProviderContatoPhoneInput() {
    return this.page.getByPlaceholder("(00) 00000-0000");
  }

  getEntityTypeSectionTitle() {
    return this.page.getByText("Tipo de entidade").first();
  }

  async gotoLegalIdentity() {
    await this.page.goto("/dashboard/settings/legal-identity");
    await this.getEntityTypeSectionTitle().waitFor({ state: "visible", timeout: 20_000 });
    await this.getPessoaFisicaButton().waitFor({ state: "visible", timeout: 20_000 });
  }

  getPessoaFisicaButton() {
    return this.page.getByRole("radio", { name: /Pessoa física/ });
  }

  getPessoaJuridicaButton() {
    return this.page.getByRole("radio", { name: /Pessoa jurídica/ });
  }

  getEntityTypeChangeDialog() {
    return this.page.getByRole("alertdialog");
  }

  async confirmEntityTypeChange() {
    const dialog = this.getEntityTypeChangeDialog();
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    await dialog.getByRole("button", { name: "Trocar" }).click();
  }

  /** Clicks PF/PJ and confirms the switch dialog when the type actually changes. */
  async selectEntityType(next: "pf" | "pj") {
    const radio = next === "pf" ? this.getPessoaFisicaButton() : this.getPessoaJuridicaButton();
    const alreadySelected = await radio.getAttribute("aria-checked");
    await radio.click();
    if (alreadySelected === "true") return;
    await this.confirmEntityTypeChange();
  }

  getLegalSectionTitle() {
    return this.page.getByText(/Documento|Empresa/).first();
  }

  getCnpjInput() {
    return this.page.getByLabel("CNPJ");
  }

  getRazaoSocialInput() {
    return this.page.getByLabel("Razão social");
  }

  getNomeFantasiaInput() {
    return this.page.getByLabel("Nome fantasia");
  }

  getCommercialContactInput() {
    return this.page
      .getByRole("group", { name: /Contato comercial/ })
      .getByLabel("Telefone ou e-mail");
  }

  getLegalCpfInput() {
    return this.page.locator("input[placeholder='000.000.000-00']").first();
  }

  async gotoProfessionalProfile() {
    await this.page.goto("/dashboard/settings/professional-profile");
    await this.getOfferedServicesSection().waitFor({ state: "visible", timeout: 20_000 });
  }

  async gotoEarnings() {
    await this.page.goto("/dashboard/settings/earnings");
    await this.getDepositosTab().waitFor({ state: "visible", timeout: 20_000 });
  }

  async gotoPayoutMethods() {
    await this.page.goto("/dashboard/settings/payout-methods");
    await this.getPayoutBankInput().waitFor({ state: "visible", timeout: 20_000 });
  }

  getPayoutBankInput() {
    return this.page.getByLabel("Banco");
  }

  getPayoutSupportLink() {
    return this.page.getByRole("link", { name: /Falar com o suporte/i });
  }

  getCobrancasTab() {
    return this.page.getByRole("tab", { name: /Cobranças/ });
  }

  getDepositosTab() {
    return this.page.getByRole("tab", { name: /Depósitos/ });
  }

  async openCobrancasTab() {
    await this.getCobrancasTab().click();
    await this.page.getByLabel("Histórico de cobranças").waitFor({ state: "visible", timeout: 10_000 });
  }

  getEsteMesButton() {
    return this.page.getByRole("button", { name: "Este mês" });
  }

  getTresMesesButton() {
    return this.page.getByRole("button", { name: "3 meses" });
  }

  getSeisMesesButton() {
    return this.page.getByRole("button", { name: "6 meses" });
  }

  getPedidosTab() {
    return this.page.getByRole("tab", { name: "Pedidos" });
  }

  getVitrineTab() {
    return this.page.getByRole("tab", { name: "Vitrine" });
  }

  async openVitrineTab() {
    await this.getVitrineTab().click();
    await this.getPublicProfileSection().waitFor({ state: "visible", timeout: 10_000 });
  }

  getOfferedServicesSection() {
    return this.page.getByText("Serviços oferecidos").first();
  }

  getBuscarServicosInput() {
    return this.page.getByPlaceholder("Buscar serviços...");
  }

  searchResultsListbox(): Locator {
    return this.page.getByRole("listbox", { name: "Resultados da busca" });
  }

  getPublicProfileSection() {
    return this.page.getByText("Perfil público").first();
  }

  getDisplayNameInput() {
    return this.page.getByLabel("Nome profissional (exibido no perfil)");
  }

  getBioTextarea() {
    return this.page.getByLabel("Biografia");
  }

  getServiceAreaLabel() {
    return this.page.getByText("Área de atuação").first();
  }

  getAdicionarCidadeButton() {
    return this.page.getByRole("button", { name: "Adicionar cidade" }).first();
  }

  getVisibilityPublicLabel() {
    return this.page.getByRole("radio", { name: /Público/ });
  }

  getVisibilityRestrictedLabel() {
    return this.page.getByRole("radio", { name: /Restrito/ });
  }

  /** Opens new tab; summary card uses a link, this is the button inside Perfil público. */
  getPublicProfileVisualizarButton() {
    return this.page.getByRole("button", { name: "Visualizar perfil" });
  }

  /**
   * Second "Copiar link do perfil" on the page (aside summary is first in DOM).
   */
  getPublicProfileCopiarLinkButton() {
    return this.page.getByRole("button", { name: "Copiar link do perfil" }).last();
  }

  getPortfolioSection() {
    return this.page.getByText("Portfólio").first();
  }

  getAdicionarTrabalhoButton() {
    return this.page.getByRole("button", { name: "Adicionar trabalho" });
  }

  getPortfolioDialogTitle() {
    return this.page.getByRole("heading", { name: "Adicionar trabalho ao portfólio" });
  }

  getPortfolioTitleInput() {
    return this.page.locator("#portfolio-title");
  }

  getPortfolioDescInput() {
    return this.page.locator("#portfolio-desc");
  }

  getPortfolioImagesInput() {
    return this.page.locator("#portfolio-images");
  }

  /** Portfolio add/edit dialog (avoids clash with address dialog Salvar). */
  portfolioFormDialog(): Locator {
    return this.page.getByRole("dialog").filter({
      has: this.page.getByRole("heading", {
        name: /Adicionar trabalho ao portfólio|Editar trabalho/,
      }),
    });
  }

  getPortfolioSalvarButton() {
    return this.portfolioFormDialog().getByRole("button", { name: "Salvar" });
  }

  getPortfolioDialogAdicionarButton() {
    return this.portfolioFormDialog().getByRole("button", { name: "Adicionar" });
  }

  /** Create flow uses "Adicionar"; edit flow uses "Salvar". */
  getPortfolioDialogSubmitButton() {
    return this.portfolioFormDialog().getByRole("button", { name: /^(Adicionar|Salvar)$/ });
  }

  getPortfolioDialogCancelButton() {
    return this.portfolioFormDialog().getByRole("button", { name: "Cancelar" });
  }

  getPortfolioEditDialogTitle() {
    return this.page.getByRole("heading", { name: "Editar trabalho" });
  }

  getPortfolioDialogFecharButton() {
    return this.portfolioFormDialog().getByRole("button", { name: "Fechar" });
  }

  getAddressDialogHeading() {
    return this.page.getByRole("heading", { name: "Adicionar endereço" });
  }

  /** Dialog or sheet (mobile) for add/edit address. */
  addressFormDialog(): Locator {
    return this.page.getByRole("dialog").filter({
      has: this.page.getByRole("heading", { name: /Adicionar endereço|Editar endereço/ }),
    });
  }

  getAddressDialogClose() {
    return this.addressFormDialog().getByRole("button", { name: "Cancelar" });
  }

  getAddressLabelInput() {
    return this.page.locator("#dialog-addr-label");
  }

  getAddressZipInput() {
    return this.page.locator("#dialog-addr-zip");
  }

  getAddressDialogSalvarButton() {
    return this.addressFormDialog().getByRole("button", { name: "Salvar" });
  }

  getPrivacyPolicyLink() {
    return this.page.getByRole("link", { name: "Ver política de privacidade" });
  }

  getNavJuridico() {
    return this.page.getByRole("link", { name: "Jurídico" });
  }

  async gotoLegal() {
    await this.page.goto("/dashboard/settings/legal");
  }

  getLegalDocumentsSection() {
    return this.page.getByLabel("Documentos jurídicos");
  }

  getTermsOfUseLink() {
    return this.page.getByRole("link", { name: "Ver termos de uso" });
  }

  getProviderPlatformContractLink() {
    return this.page.getByRole("link", { name: "Ver contrato de uso da plataforma" });
  }

  getLogoutDialogCancelButton() {
    return this.getLogoutAlertDialog().getByRole("button", { name: "Cancelar" });
  }

  getLegalRepresentativeCpfInput() {
    return this.page.getByRole("group", { name: /Representante legal/ }).getByLabel("CPF");
  }

  portfolioItemRowByTitle(titleSubstring: string): Locator {
    return this.page.locator("li").filter({ hasText: titleSubstring });
  }

  getErrorStateTitle() {
    return this.page.getByRole("heading", { name: "Não foi possível carregar sua conta" });
  }

  getRetryButton() {
    return this.page.getByRole("button", { name: /Tentar novamente|Recarregar/i });
  }

  toastSuccess(text: string | RegExp) {
    return this.page.getByText(text);
  }

  /** Sonner may leave multiple toast nodes in DOM; target a visible one. */
  getDadosAtualizadosToast() {
    return this.page.getByText("Dados atualizados com sucesso.", { exact: true }).first();
  }
}

export function getSettingsClientCredentials() {
  return {
    email:
      process.env.E2E_MY_ACCOUNT_CLIENT_EMAIL ??
      "e2e.myaccount.client@prestway.test",
    password: process.env.E2E_MY_ACCOUNT_PASSWORD ?? "E2E_SecurePass123!",
  };
}

export function getSettingsProviderCredentials() {
  return {
    email:
      process.env.E2E_MY_ACCOUNT_PROVIDER_EMAIL ??
      "e2e.myaccount.provider@prestway.test",
    password: process.env.E2E_MY_ACCOUNT_PASSWORD ?? "E2E_SecurePass123!",
  };
}
