/**
 * E2E: My Account page — provider role, real Supabase. Session via storageState
 * (my-account-provider.setup.ts). Clipboard permission granted per test for copy-link flows.
 *
 * UI copy in assertions stays PT-BR to match the app.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openMyAccountLoggedIn } from "../helpers/open-my-account";
import { MyAccountPage } from "../pages/my-account.page";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TINY_PNG = path.join(__dirname, "../fixtures/tiny.png");

test.describe("My Account — provider", () => {
  test.describe.configure({ mode: "serial" });

  function visibilityOptionLabel(page: import("@playwright/test").Page, target: "public" | "restricted") {
    return target === "public"
      ? page.getByText(
          "Público — qualquer pessoa pode ver e o perfil pode ser indexado por buscadores."
        )
      : page.getByText("Restrito — apenas clientes logados podem ver.");
  }

  async function ensureVisibilityAndSave(page: import("@playwright/test").Page, target: "public" | "restricted") {
    const input = page.locator(`input[name="profile_visibility"][value="${target}"]`);
    const oppositeTarget = target === "public" ? "restricted" : "public";
    const oppositeLabel = visibilityOptionLabel(page, oppositeTarget);
    const targetLabel = visibilityOptionLabel(page, target);

    // Radios use sr-only inputs; click visible copy so labels/mobile header do not block the hit target.
    if (await input.isChecked()) {
      await oppositeLabel.scrollIntoViewIfNeeded();
      await oppositeLabel.click();
      await expect(page.getByText("Dados atualizados com sucesso.", { exact: true }).first()).toBeVisible({
        timeout: 12_000,
      });
    }

    await targetLabel.scrollIntoViewIfNeeded();
    await targetLabel.click();
    await expect(page.getByText("Dados atualizados com sucesso.", { exact: true }).first()).toBeVisible({
      timeout: 12_000,
    });
  }

  test.beforeEach(async ({ page, context }) => {
    // WebKit (mobile-safari) does not support clipboard-write via CDP; Chromium needs it for copy-link tests.
    const browserName = context.browser()?.browserType().name() ?? "";
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: "http://localhost:5173",
      });
    }
    await openMyAccountLoggedIn(page);
  });

  test("shows provider subtitle, live-since label and profile links in summary", async ({
    page,
  }) => {
    const acc = new MyAccountPage(page);
    await expect(acc.getProviderSubtitle()).toBeVisible();
    await expect(acc.getSinceLabelProvider()).toBeVisible();
    await expect(acc.getVisualizarPerfilSummary()).toBeVisible();
    await expect(acc.getCopiarLinkSummary()).toBeVisible();
    const perfilHref = await acc.getVisualizarPerfilSummary().getAttribute("href");
    expect(perfilHref).toMatch(/\/perfil\//);
  });

  test("shows provider-only sections: entity type, legal, services, public profile, portfolio", async ({
    page,
  }) => {
    const acc = new MyAccountPage(page);
    const t = 25_000;
    await expect(acc.getEntityTypeSectionTitle()).toBeVisible({ timeout: t });
    await expect(acc.getLegalSectionTitle()).toBeVisible({ timeout: t });
    await expect(acc.getOfferedServicesSection()).toBeVisible({ timeout: t });
    await expect(acc.getPublicProfileSection()).toBeVisible({ timeout: t });
    await expect(acc.getPortfolioSection()).toBeVisible({ timeout: t });
  });

  test("session: logout dialog cancel stays on conta", async ({ page }) => {
    const acc = new MyAccountPage(page);
    await acc.getSairDaPlataformaButton().scrollIntoViewIfNeeded();
    await acc.getSairDaPlataformaButton().click();
    await expect(acc.getLogoutAlertDialog()).toBeVisible({ timeout: 15_000 });
    await expect(acc.getLogoutDialogTitle()).toBeVisible();
    await acc.getLogoutDialogCancelButton().click();
    await expect(acc.getLogoutAlertDialog()).not.toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/conta/);
  });

  test("privacy: DPO mailto and export dialog", async ({ page }) => {
    const acc = new MyAccountPage(page);
    await expect(acc.getFalarComDpoLink()).toHaveAttribute("href", /^mailto:dpo@renovi\.com\.br/i);
    await acc.getExportarDadosButton().scrollIntoViewIfNeeded();
    await acc.getExportarDadosButton().click();
    await expect(acc.getExportarAlertDialog()).toBeVisible({ timeout: 15_000 });
    await expect(acc.getExportarDialogTitle()).toBeVisible();
    await acc.getExportarEntendiButton().click();
  });

  test("danger zone: delete account opens DPO instructions", async ({ page }) => {
    const acc = new MyAccountPage(page);
    await acc.getExcluirContaButton().scrollIntoViewIfNeeded();
    await acc.getExcluirContaButton().click();
    await expect(acc.getExcluirContaAlertDialog()).toBeVisible({ timeout: 15_000 });
    await expect(acc.getExcluirContaDialogTitle()).toBeVisible();
    await expect(page.getByText("dpo@renovi.com.br")).toBeVisible();
    await acc.getExcluirContaEntendiButton().click();
  });

  test("edge: single-word full name shows validation toast (provider auto-save)", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getFullNameInput().fill("Somente");
    await page.waitForTimeout(2500);
    await expect(
      page.getByText("Não foi possível salvar os campos automaticamente porque há um campo inválido.")
    ).toBeVisible({ timeout: 8000 });
    await acc.getFullNameInput().fill("E2E Prestador Pós Erro Nome");
    await page.waitForTimeout(2500);
    await expect(acc.getDadosAtualizadosToast()).toBeVisible({ timeout: 15_000 });
    await acc.getFullNameInput().fill("E2E Prestador Conta");
    await page.waitForTimeout(2500);
    await expect(acc.getDadosAtualizadosToast()).toBeVisible({ timeout: 15_000 });
  });

  test("edge: invalid provider phone shows validation toast", async ({ page }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getProviderContatoPhoneInput().fill("(11) 9999");
    await page.waitForTimeout(2500);
    await expect(
      page.getByText("Não foi possível salvar os campos automaticamente porque há um campo inválido.")
    ).toBeVisible({ timeout: 8000 });
  });

  test("edge: PJ with invalid CNPJ shows validation toast", async ({ page }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getPessoaJuridicaButton().click();
    await acc.getRazaoSocialInput().fill("E2E Razão Social");
    await acc.getCnpjInput().fill("11.111.111/1111-11");
    await page.waitForTimeout(2500);
    await expect(
      page.getByText("Não foi possível salvar os campos automaticamente porque há um campo inválido.")
    ).toBeVisible({ timeout: 8000 });
  });

  test("edge: PJ invalid legal representative CPF shows validation toast", async ({ page }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getPessoaJuridicaButton().click();
    await acc.getCnpjInput().fill("11.222.333/0001-81");
    await acc.getRazaoSocialInput().fill("E2E Prestador LTDA");
    await acc.getLegalRepresentativeCpfInput().fill("111.111.111-11");
    await page.waitForTimeout(2500);
    await expect(
      page.getByText("Não foi possível salvar os campos automaticamente porque há um campo inválido.")
    ).toBeVisible({ timeout: 8000 });
  });

  test("edge: display name over 120 chars shows validation toast", async ({ page }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getDisplayNameInput().fill("x".repeat(121));
    await page.waitForTimeout(2500);
    await expect(
      page.getByText("Não foi possível salvar os campos automaticamente porque há um campo inválido.")
    ).toBeVisible({ timeout: 8000 });
  });

  test("edge: bio over 2000 chars shows validation toast", async ({ page }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getBioTextarea().fill("b".repeat(2001));
    await page.waitForTimeout(2500);
    await expect(
      page.getByText("Não foi possível salvar os campos automaticamente porque há um campo inválido.")
    ).toBeVisible({ timeout: 8000 });
  });

  test("edge: commercial contact over 120 chars shows validation toast", async ({ page }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getPessoaJuridicaButton().click();
    await acc.getCnpjInput().fill("11.222.333/0001-81");
    await acc.getRazaoSocialInput().fill("E2E Prestador LTDA");
    await acc.getCommercialContactInput().fill("c".repeat(121));
    await page.waitForTimeout(2500);
    await expect(
      page.getByText("Não foi possível salvar os campos automaticamente porque há um campo inválido.")
    ).toBeVisible({ timeout: 8000 });
  });

  test("edge: PF invalid CPF in legal section shows validation toast", async ({ page }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getPessoaFisicaButton().click();
    await acc.getLegalCpfInput().fill("111.111.111-11");
    await page.waitForTimeout(2500);
    await expect(
      page.getByText("Não foi possível salvar os campos automaticamente porque há um campo inválido.")
    ).toBeVisible({ timeout: 8000 });
  });

  test("edge: PJ without CNPJ and corporate name shows auto-save validation toast", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getPessoaJuridicaButton().click();
    await acc.getCnpjInput().fill("");
    await acc.getRazaoSocialInput().fill("");
    await acc.getProviderContatoPhoneInput().fill("(21) 97777-6655");
    await page.waitForTimeout(2500);
    await expect(
      page.getByText("Não foi possível salvar os campos automaticamente porque há um campo inválido.")
    ).toBeVisible({ timeout: 8000 });
  });

  test("auto-save: PJ with valid CNPJ and corporate name persists", async ({ page }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getPessoaJuridicaButton().click();
    await acc.getCnpjInput().fill("11.222.333/0001-81");
    // Unique suffix so the field is always dirty vs server (avoids missing toast).
    const razao = `E2E Prestador LTDA ${Date.now().toString().slice(-6)}`;
    await acc.getRazaoSocialInput().fill(razao);
    await expect(acc.getDadosAtualizadosToast()).toBeVisible({ timeout: 20_000 });
  });

  test("PF: valid CPF in legal section saves", async ({ page }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getPessoaFisicaButton().click();
    await acc.getLegalCpfInput().fill("529.982.247-25");
    await expect(acc.getDadosAtualizadosToast()).toBeVisible({ timeout: 12_000 });
  });

  test("public profile: display name and bio persist", async ({ page }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    const tag = Date.now().toString().slice(-5);
    await acc.getDisplayNameInput().fill(`E2E Pro ${tag}`);
    await acc.getBioTextarea().fill(`Bio E2E linha única ${tag}.`);
    await expect(acc.getDadosAtualizadosToast()).toBeVisible({ timeout: 12_000 });
  });

  test("visibility: switching to public profile saves", async ({ page }) => {
    test.setTimeout(45_000);
    await ensureVisibilityAndSave(page, "public");
  });

  test("visibility: switching to restricted profile saves", async ({ page }) => {
    test.setTimeout(45_000);
    await ensureVisibilityAndSave(page, "restricted");
  });

  test("service area: open add-city flow", async ({ page }) => {
    const acc = new MyAccountPage(page);
    await expect(acc.getServiceAreaLabel()).toBeVisible();
    await acc.getAdicionarCidadeButton().click();
    await expect(page.getByPlaceholder("Digite o nome da cidade...")).toBeVisible({
      timeout: 5000,
    });
    await page.keyboard.press("Escape");
  });

  test("offered services: search shows list or empty state", async ({ page }) => {
    const acc = new MyAccountPage(page);
    await acc.getBuscarServicosInput().click();
    await acc.getBuscarServicosInput().fill("a");
    await page.waitForTimeout(600);
    const list = acc.searchResultsListbox();
    await expect(list).toBeVisible({ timeout: 8000 });
    const first = page.getByRole("option").first();
    await expect(first).toBeVisible({ timeout: 15_000 });
    // Avoid selecting a service here (next test covers add/remove; parallel projects share one seeded user).
    await expect(acc.getBuscarServicosInput()).toBeVisible();
  });

  test("offered services: add first search result then remove via badge", async ({ page }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getBuscarServicosInput().click();
    await acc.getBuscarServicosInput().fill("a");
    await page.waitForTimeout(800);
    const opt = page.getByRole("option").first();
    await expect(opt).toBeVisible({ timeout: 15_000 });
    const titleText = (await opt.textContent())?.trim() ?? "";
    await opt.click();
    await acc.getBuscarServicosInput().fill("");
    await page.keyboard.press("Tab");
    await expect(acc.searchResultsListbox()).not.toBeVisible({ timeout: 8000 });
    const removeBtn = page.getByRole("button", { name: `Remover ${titleText}` });
    await expect(removeBtn).toBeVisible({ timeout: 5000 });
    await removeBtn.click();
    await expect(removeBtn).not.toBeVisible({ timeout: 8000 });
  });

  test("portfolio: add disabled when title is empty or whitespace", async ({ page }) => {
    const acc = new MyAccountPage(page);
    await acc.getAdicionarTrabalhoButton().scrollIntoViewIfNeeded();
    await acc.getAdicionarTrabalhoButton().click();
    await expect(acc.getPortfolioDialogTitle()).toBeVisible();
    await acc.getPortfolioTitleInput().fill("   ");
    await expect(acc.getPortfolioDialogAdicionarButton()).toBeDisabled();
    await acc.getPortfolioDialogCancelButton().click();
    await expect(acc.getPortfolioDialogTitle()).not.toBeVisible();
  });

  test("portfolio: Fechar button closes add dialog without saving", async ({ page }) => {
    const acc = new MyAccountPage(page);
    await acc.getAdicionarTrabalhoButton().scrollIntoViewIfNeeded();
    await acc.getAdicionarTrabalhoButton().click();
    await expect(acc.getPortfolioDialogTitle()).toBeVisible();
    await acc.getPortfolioTitleInput().fill("E2E Fechar Sem Salvar");
    await acc.getPortfolioDialogFecharButton().click();
    await expect(acc.getPortfolioDialogTitle()).not.toBeVisible();
    await expect(acc.portfolioItemRowByTitle("E2E Fechar Sem Salvar")).not.toBeVisible();
  });

  test("portfolio: create, edit title/description, then delete item", async ({ page }) => {
    test.setTimeout(120_000);
    const acc = new MyAccountPage(page);
    const baseTitle = `E2E Chain ${Date.now()}`;
    const editedTitle = `${baseTitle} editado`;

    await acc.getAdicionarTrabalhoButton().scrollIntoViewIfNeeded();
    await acc.getAdicionarTrabalhoButton().click();
    await expect(acc.getPortfolioDialogTitle()).toBeVisible();
    await acc.getPortfolioTitleInput().fill(baseTitle);
    await acc.getPortfolioDescInput().fill("Descrição inicial E2E.");
    await acc.getPortfolioImagesInput().setInputFiles(TINY_PNG);
    await acc.getPortfolioDialogAdicionarButton().click();
    await expect(acc.getPortfolioDialogTitle()).not.toBeVisible({ timeout: 30_000 });

    const row = acc.portfolioItemRowByTitle(baseTitle);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: `Editar ${baseTitle}` }).click();
    await expect(acc.getPortfolioEditDialogTitle()).toBeVisible({ timeout: 10_000 });
    await acc.getPortfolioTitleInput().fill(editedTitle);
    await acc.getPortfolioDescInput().fill("Descrição após edição.");
    await acc.getPortfolioSalvarButton().click();
    await expect(acc.getPortfolioEditDialogTitle()).not.toBeVisible({ timeout: 30_000 });

    const editedRow = acc.portfolioItemRowByTitle(editedTitle);
    await expect(editedRow).toBeVisible({ timeout: 15_000 });
    await editedRow.getByRole("button", { name: `Excluir ${editedTitle}` }).click();
    await expect(editedRow).not.toBeVisible({ timeout: 25_000 });
  });

  test("profile photo: upload tiny PNG then remove when control visible", async ({ page }) => {
    test.setTimeout(60_000);
    const acc = new MyAccountPage(page);
    await expect(acc.getAlterarFotoButton()).toBeVisible();
    await acc.getPhotoFileInput().setInputFiles(TINY_PNG);
    await expect(page.getByText("Foto atualizada com sucesso.")).toBeVisible({ timeout: 20_000 });
    const remover = acc.getRemoverFotoButton();
    if (await remover.isVisible()) {
      await remover.click();
      await expect(page.getByText("Foto removida.")).toBeVisible({ timeout: 20_000 });
    }
  });

  test("privacy: policy link when main site URL is configured", async ({ page }) => {
    const acc = new MyAccountPage(page);
    const link = acc.getPrivacyPolicyLink();
    if (await link.isVisible().catch(() => false)) {
      await expect(link).toHaveAttribute("href", /politica-de-privacidade/);
    }
  });

  test("public profile: copy link shows toast", async ({ page }) => {
    const acc = new MyAccountPage(page);
    await acc.getPublicProfileCopiarLinkButton().scrollIntoViewIfNeeded();
    await acc.getPublicProfileCopiarLinkButton().click();
    await expect(
      page.getByText("Link copiado para a área de transferência.")
    ).toBeVisible({ timeout: 8000 });
  });

  test("summary card: copy profile link shows toast", async ({ page }) => {
    const acc = new MyAccountPage(page);
    await acc.getCopiarLinkSummary().click();
    await expect(page.getByText("Link copiado.")).toBeVisible({ timeout: 8000 });
  });

  test("entity type help opens dialog", async ({ page }) => {
    await page.getByRole("button", { name: /Preciso de ajuda para escolher/i }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Tipo de entidade" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("does not show fatal error state when session is valid", async ({ page }) => {
    const acc = new MyAccountPage(page);
    await expect(acc.getErrorStateTitle()).not.toBeVisible();
  });

  test("PJ: nome fantasia optional field accepts text and saves with valid PJ core", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    const acc = new MyAccountPage(page);
    await acc.getPessoaJuridicaButton().click();
    await acc.getCnpjInput().fill("11.222.333/0001-81");
    await acc.getRazaoSocialInput().fill("E2E Prestador LTDA");
    const tag = Date.now().toString().slice(-5);
    await acc.getNomeFantasiaInput().fill(`Fantasia E2E ${tag}`);
    await expect(acc.getDadosAtualizadosToast()).toBeVisible({ timeout: 12_000 });
  });

  test("form footer shows auto-save hint when idle", async ({ page }) => {
    const acc = new MyAccountPage(page);
    await expect(acc.getAutoSaveStatus()).toContainText(
      "As alterações são salvas automaticamente."
    );
  });

  test("logout ends session", async ({ page }) => {
    const acc = new MyAccountPage(page);
    await acc.getSairDaPlataformaButton().scrollIntoViewIfNeeded();
    await acc.getSairDaPlataformaButton().click();
    await expect(acc.getLogoutAlertDialog()).toBeVisible({ timeout: 15_000 });
    await acc.getLogoutConfirmButton().click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });
});
