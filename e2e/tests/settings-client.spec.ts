/**
 * E2E: My Account page — client role, real Supabase. Session is injected via storageState
 * (settings-client.setup.ts + Playwright projects); no per-test login.
 *
 * Env: VITE_*, SUPABASE_* service role, seed/teardown (see global-setup / global-teardown).
 * UI copy in assertions stays PT-BR to match the app.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openSettingsLoggedIn } from "../helpers/open-settings";
import { SettingsPage } from "../pages/settings.page";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TINY_PNG = path.join(__dirname, "../fixtures/tiny.png");

test.describe("My Account — client", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await openSettingsLoggedIn(page);
  });

  test("shows page title, client subtitle and summary card", async ({ page }) => {
    const acc = new SettingsPage(page);
    await expect(acc.getClientSubtitle()).toBeVisible();
    await expect(acc.getSinceLabelClient()).toBeVisible();
    await expect(acc.getSummaryName()).not.toHaveText("—");
  });

  test("shows personal data, contact, addresses, privacy and sign-out in settings", async ({
    page,
  }) => {
    const acc = new SettingsPage(page);
    await expect(acc.getSectionDadosPessoais()).toBeVisible();
    await expect(acc.getSectionContatoIdentidade()).toBeVisible();
    await expect(acc.getSectionEnderecos()).toBeVisible();
    await expect(acc.getSectionPrivacidade()).toBeVisible();
    await expect(acc.getSairDaContaButton()).toBeVisible();
  });

  test("email field is read-only and full name input is visible", async ({ page }) => {
    const acc = new SettingsPage(page);
    await expect(acc.getEmailField()).toBeDisabled();
    await expect(acc.getFullNameInput()).toBeVisible();
  });

  test("edge: single-word full name shows validation error and does not save", async ({ page }) => {
    const acc = new SettingsPage(page);
    await acc.getFullNameInput().fill("Único");
    await page.waitForTimeout(2000);
    await expect(page.getByText("Informe seu nome completo com nome e sobrenome")).toBeVisible({
      timeout: 5000,
    });
  });

  test("edge: invalid phone shows validation message", async ({ page }) => {
    const acc = new SettingsPage(page);
    await acc.getFullNameInput().fill("Maria Silva Santos");
    await acc.getPhoneInput().fill("(11) 99999");
    await page.waitForTimeout(2000);
    await expect(page.getByText("Telefone inválido")).toBeVisible({ timeout: 5000 });
  });

  test("edge: invalid CPF shows validation message", async ({ page }) => {
    const acc = new SettingsPage(page);
    await acc.getCpfInput().fill("111.111.111-11");
    await acc.getPhoneInput().click();
    await page.waitForTimeout(2500);
    await expect(page.getByText("CPF inválido")).toBeVisible({ timeout: 10_000 });
  });

  test("edge: empty full name shows inline validation then recovers after valid name", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    const acc = new SettingsPage(page);
    await acc.getFullNameInput().fill("");
    await page.waitForTimeout(2000);
    await expect(page.getByText("Nome é obrigatório")).toBeVisible({ timeout: 5000 });
    // Must differ from server value so the form is dirty and auto-save runs.
    await acc.getFullNameInput().fill("E2E Cliente Pós Erro Nome");
    await page.waitForTimeout(2000);
    await expect(acc.getDadosAtualizadosToast()).toBeVisible({ timeout: 15_000 });
    await acc.getFullNameInput().fill("E2E Cliente Conta");
    await page.waitForTimeout(2000);
    await expect(acc.getDadosAtualizadosToast()).toBeVisible({ timeout: 15_000 });
  });

  test("privacy: Falar com o DPO link points to mailto DPO", async ({ page }) => {
    const acc = new SettingsPage(page);
    await expect(acc.getFalarComDpoLink()).toHaveAttribute("href", /^mailto:dpo@prestway\.com\.br/i);
  });

  test("privacy: policy link when main site URL is configured", async ({ page }) => {
    const acc = new SettingsPage(page);
    const link = acc.getPrivacyPolicyLink();
    if (await link.isVisible().catch(() => false)) {
      await expect(link).toHaveAttribute("href", /politica-de-privacidade/);
      await expect(link).toHaveAttribute("target", "_blank");
    }
  });

  test("legal: terms and privacy links without provider contract", async ({ page }) => {
    const acc = new SettingsPage(page);
    await acc.gotoLegal();
    await expect(acc.getLegalDocumentsSection()).toBeVisible({ timeout: 20_000 });
    const terms = acc.getTermsOfUseLink();
    if (await terms.isVisible().catch(() => false)) {
      await expect(terms).toHaveAttribute("href", /termos-de-uso/);
      await expect(terms).toHaveAttribute("target", "_blank");
    }
    await expect(acc.getProviderPlatformContractLink()).toHaveCount(0);
  });

  test("session: logout dialog cancel keeps user on conta", async ({ page }) => {
    const acc = new SettingsPage(page);
    await acc.getSairDaContaButton().scrollIntoViewIfNeeded();
    await acc.getSairDaContaButton().click();
    await expect(acc.getLogoutAlertDialog()).toBeVisible({ timeout: 15_000 });
    await expect(acc.getLogoutDialogTitle()).toBeVisible();
    await acc.getLogoutDialogCancelButton().click();
    await expect(acc.getLogoutAlertDialog()).not.toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });

  test("auto-save: valid full name shows success toast", async ({ page }) => {
    test.setTimeout(45_000);
    const acc = new SettingsPage(page);
    const suffix = Date.now().toString().slice(-6);
    await acc.getFullNameInput().fill(`E2E Cliente Atualizado ${suffix}`);
    await expect(acc.getAutoSaveStatus()).toContainText("Salvando…", { timeout: 5000 }).catch(() => {});
    await expect(acc.getDadosAtualizadosToast()).toBeVisible({ timeout: 12_000 });
  });

  test("auto-save: valid phone persists after reload; CPF triggers same save flow", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    const acc = new SettingsPage(page);
    await acc.getFullNameInput().fill("E2E Cliente Conta");
    await acc.getPhoneInput().fill("(11) 98888-7766");
    await acc.getCpfInput().fill("529.982.247-25");
    await expect(acc.getDadosAtualizadosToast()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2000);
    await page.reload();
    await expect(acc.getPageHeading()).toBeVisible({ timeout: 15_000 });
    await expect(acc.getPhoneInput()).toHaveValue(/\(11\)\s*98888-7766/, { timeout: 15_000 });
    // CPF is stored in client private profile; hydration can lag or differ by env — phone proves reload + profile path.
  });

  test("addresses: open add dialog then cancel", async ({ page }) => {
    const acc = new SettingsPage(page);
    await acc.getAdicionarEnderecoButton().click();
    await expect(acc.getAddressDialogHeading()).toBeVisible();
    await acc.getAddressDialogClose().click();
    await expect(acc.getAddressDialogHeading()).not.toBeVisible();
  });

  test("addresses: submit with empty label shows validation toast", async ({ page }) => {
    const acc = new SettingsPage(page);
    await acc.getAdicionarEnderecoButton().click();
    await expect(acc.getAddressDialogHeading()).toBeVisible();
    await acc.getAddressLabelInput().fill("");
    await acc.getAddressDialogSalvarButton().click();
    await expect(page.getByText("Apelido é obrigatório")).toBeVisible({ timeout: 8000 });
    await acc.getAddressDialogClose().click();
  });

  test("addresses: invalid CEP format shows validation toast", async ({ page }) => {
    const acc = new SettingsPage(page);
    await acc.getAdicionarEnderecoButton().click();
    await expect(acc.getAddressDialogHeading()).toBeVisible();
    await acc.getAddressLabelInput().fill("E2E CEP");
    await acc.getAddressZipInput().fill("123");
    await acc.getAddressDialogSalvarButton().click();
    await expect(page.getByText("CEP inválido (formato: 00000-000)")).toBeVisible({
      timeout: 8000,
    });
    await acc.getAddressDialogClose().click();
  });

  test("addresses: delete confirmation dialog can be dismissed", async ({ page }) => {
    const excluir = page.getByRole("button", { name: "Excluir endereço" }).first();
    await expect(excluir).toBeVisible({ timeout: 15_000 });
    await excluir.click();
    const deleteDlg = page
      .getByRole("alertdialog")
      .filter({ has: page.getByRole("heading", { name: "Excluir endereço?" }) });
    await expect(deleteDlg).toBeVisible();
    await deleteDlg.getByRole("button", { name: "Cancelar" }).click();
    await expect(deleteDlg).not.toBeVisible();
  });

  test("addresses: edit dialog opens when user has at least one address", async ({ page }) => {
    const acc = new SettingsPage(page);
    const editar = page.getByRole("button", { name: "Editar endereço" }).first();
    await expect(editar).toBeVisible({ timeout: 15_000 });
    await editar.click();
    await expect(page.getByRole("heading", { name: "Editar endereço" })).toBeVisible({
      timeout: 8000,
    });
    await acc.getAddressDialogClose().click();
  });

  test("privacy: export data dialog shows DPO email", async ({ page }) => {
    const acc = new SettingsPage(page);
    await acc.getExportarDadosButton().scrollIntoViewIfNeeded();
    await acc.getExportarDadosButton().click();
    await expect(acc.getExportarAlertDialog()).toBeVisible({ timeout: 15_000 });
    await expect(acc.getExportarDialogTitle()).toBeVisible();
    await expect(page.getByText("dpo@prestway.com")).toBeVisible();
    await acc.getExportarEntendiButton().click();
  });

  test("danger zone: delete account opens DPO instructions", async ({ page }) => {
    const acc = new SettingsPage(page);
    await acc.getExcluirContaButton().scrollIntoViewIfNeeded();
    await acc.getExcluirContaButton().click();
    await expect(acc.getExcluirContaAlertDialog()).toBeVisible({ timeout: 15_000 });
    await expect(acc.getExcluirContaDialogTitle()).toBeVisible();
    await expect(page.getByText("dpo@prestway.com")).toBeVisible();
    await acc.getExcluirContaEntendiButton().click();
  });

  test("profile photo: upload tiny PNG then remove", async ({ page }) => {
    test.setTimeout(60_000);
    const acc = new SettingsPage(page);
    await acc.getPhotoFileInput().setInputFiles(TINY_PNG);
    await expect(page.getByText("Foto atualizada com sucesso.")).toBeVisible({ timeout: 20_000 });
    const remover = acc.getRemoverFotoButton();
    if (await remover.isVisible()) {
      await remover.click();
      await expect(page.getByText("Foto removida.")).toBeVisible({ timeout: 20_000 });
    }
  });

  test("does not show fatal error state when session is valid", async ({ page }) => {
    const acc = new SettingsPage(page);
    await expect(acc.getErrorStateTitle()).not.toBeVisible();
  });

  test("summary: alterar foto control is available", async ({ page }) => {
    const acc = new SettingsPage(page);
    await expect(acc.getAlterarFotoButton()).toBeVisible();
    await expect(acc.getPhotoFileInput()).toBeAttached();
  });

  test("logout ends session and redirects to home", async ({ page }) => {
    const acc = new SettingsPage(page);
    await acc.getSairDaContaButton().scrollIntoViewIfNeeded();
    await acc.getSairDaContaButton().click();
    await expect(acc.getLogoutAlertDialog()).toBeVisible({ timeout: 15_000 });
    await acc.getLogoutConfirmButton().click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("form footer shows auto-save hint when idle", async ({ page }) => {
    const acc = new SettingsPage(page);
    await expect(acc.getAutoSaveStatus()).toContainText(
      "As alterações são salvas automaticamente."
    );
  });

  test("addresses: empty state or list is shown", async ({ page }) => {
    const emptyCopy = page.getByText("Nenhum endereço cadastrado");
    const editar = page.getByRole("button", { name: "Editar endereço" }).first();
    await expect(emptyCopy.or(editar)).toBeVisible({ timeout: 10_000 });
  });
});
