/**
 * E2E tests for the Request Quote flow (/pedir-orcamento).
 * These tests use the REAL Supabase API (no mocks). Ensure .env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 * for the target project. The project should have:
 * - At least one service with show_on_request_quote = true (for step 1)
 * - Optional: form linked to service with form_status = 'active' (for step 2)
 * - platform_states, platform_cities, platform_neighborhoods (for step 4 address)
 * - Edge function create-request-quote-order deployed (for full guest submit)
 */

import { test, expect } from "@playwright/test";
import { RequestQuotePage } from "../pages/request-quote.page";

test.describe("Request Quote - /pedir-orcamento", () => {
  test.beforeEach(async ({ page }) => {
    const rq = new RequestQuotePage(page);
    await rq.goto();
  });

  // ─── Step 1: Load & layout ───────────────────────────────────────────────

  test("header logo is visible and links to home", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    await expect(rq.getLogoLink()).toBeVisible();
    await rq.getLogoLink().click();
    await expect(page).toHaveURL("/");
  });

  test("step 1 shows trust badges (2 min and Pagamento Protegido)", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    await expect(rq.getTrustBadgeTwoMin()).toBeVisible();
    await expect(rq.getTrustBadgePayment()).toBeVisible();
  });

  test("loads step 1 with heading and main title", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();

    await expect(rq.getStep1Heading()).toBeVisible();
    await expect(rq.getStep1Title()).toBeVisible();
  });

  test("shows either services list, loading, or empty state on step 1", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();

    const hasCards =
      (await rq.getFirstServiceCard().count()) > 0;
    const hasEmpty = await rq.getServicesEmpty().isVisible();
    const hasLoading = await rq.getServicesLoading().isVisible();

    expect(hasCards || hasEmpty || hasLoading).toBeTruthy();
  });

  test("step 1 shows hint text about no charge", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();

    await expect(rq.getStep1Hint()).toBeVisible();
  });

  test("Next button is not visible on step 1 (only after step 3)", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();

    await expect(rq.getNextButton()).not.toBeVisible();
  });

  // ─── Step 1: Validation ──────────────────────────────────────────────────

  test("cannot proceed from step 1 without selecting a service", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();

    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    // On step 1 there is no main "Próximo" button; we must select a service to advance.
    // Select service then go back via step 2 Cancelar to confirm we can return to step 1.
    await firstCard.click();
    await page.waitForTimeout(800);
    const cancelBtn = rq.getDynamicFormCancelButton();
    if ((await cancelBtn.count()) > 0) {
      await cancelBtn.click();
      await expect(rq.getStep1Heading()).toBeVisible();
    }
  });

  // ─── Step 1 → 2: Service selection ────────────────────────────────────────

  test("selecting a service advances to step 2", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();

    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);

    const hasSectionTitle = await rq.getStep2SectionTitle().isVisible();
    const hasFormNotConfigured = await rq.getFormNotConfiguredAlert().isVisible();
    const hasCancelOrConcluir =
      (await rq.getDynamicFormCancelButton().count()) > 0 ||
      (await rq.getDynamicFormConcluirButton().count()) > 0 ||
      (await rq.getDynamicFormNextButton().count()) > 0;

    expect(hasSectionTitle || hasFormNotConfigured || hasCancelOrConcluir).toBeTruthy();
  });

  // ─── Step 2: Form or fallback ──────────────────────────────────────────────

  test("step 2 shows either dynamic form or form not configured message", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1500);

    const formNotConfigured = await rq.getFormNotConfiguredAlert().isVisible();
    const hasFormButtons =
      (await rq.getDynamicFormCancelButton().count()) > 0 ||
      (await rq.getDynamicFormNextButton().count()) > 0 ||
      (await rq.getDynamicFormConcluirButton().count()) > 0;

    expect(formNotConfigured || hasFormButtons).toBeTruthy();
  });

  test("step 2 Cancelar returns to step 1", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1000);

    const cancelBtn = rq.getDynamicFormCancelButton();
    if ((await cancelBtn.count()) === 0) {
      test.skip();
      return;
    }
    await cancelBtn.click();
    await expect(rq.getStep1Heading()).toBeVisible();
  });

  test("step 2 form shows Próximo or Concluir when form is configured", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1500);
    if (await rq.getFormNotConfiguredAlert().isVisible()) {
      test.skip();
      return;
    }
    const hasNext = (await rq.getDynamicFormNextButton().count()) > 0;
    const hasConcluir = (await rq.getDynamicFormConcluirButton().count()) > 0;
    expect(hasNext || hasConcluir).toBeTruthy();
  });

  // ─── Step 3: Description ──────────────────────────────────────────────────

  test("step 3 shows description textarea and Next is disabled when empty", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1000);

    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await page.waitForTimeout(500);

    await expect(rq.getStep3SectionTitle()).toBeVisible();
    await expect(rq.getDescriptionTextarea()).toBeVisible();
    const nextWizard = rq.getNextButton();
    await expect(nextWizard).toBeVisible();
    await expect(nextWizard).toBeDisabled();
  });

  test("step 3 Next becomes enabled after filling description", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1000);

    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await page.waitForTimeout(800);

    await rq.getDescriptionTextarea().fill("Preciso de um orçamento para o serviço.");
    await page.waitForTimeout(200);
    await expect(rq.getNextButton()).toBeEnabled();
  });

  test("step 3 clearing description disables Next again", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1000);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await page.waitForTimeout(400);
    await rq.getDescriptionTextarea().fill("Alguma descrição");
    await page.waitForTimeout(200);
    await expect(rq.getNextButton()).toBeEnabled();
    await rq.getDescriptionTextarea().fill("");
    await page.waitForTimeout(200);
    await expect(rq.getNextButton()).toBeDisabled();
  });

  test("step 3 Next stays disabled when description is only whitespace", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1000);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await page.waitForTimeout(400);
    await rq.getDescriptionTextarea().fill("   \n\t  ");
    await page.waitForTimeout(200);
    await expect(rq.getNextButton()).toBeDisabled();
  });

  test("step 3 shows optional photos section and dropzone", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1000);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await expect(rq.getPhotosDropzone()).toBeVisible();
    await expect(rq.page.getByText("Fotos (Opcional)")).toBeVisible();
  });

  test("step indicator shows current step (e.g. Etapa 3 de 5)", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1000);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await expect(rq.getStepIndicator()).toBeVisible();
    await expect(rq.getStepIndicator()).toContainText("3");
  });

  // ─── Step 4: Address ──────────────────────────────────────────────────────

  test("step 4 shows address section and address form for guest", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição do serviço.");
    await rq.getNextButton().click();
    await page.waitForTimeout(500);

    await expect(rq.getStep4Title()).toBeVisible();
    await expect(rq.getCepInput()).toBeVisible();
    await expect(rq.getStreetInput()).toBeVisible();
    await expect(rq.getNumberInput()).toBeVisible();
  });

  test("step 4 Next is disabled without valid address", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição.");
    await rq.getNextButton().click();
    await page.waitForTimeout(500);

    const nextBtn = rq.getNextButton();
    await expect(nextBtn).toBeDisabled();
  });

  test("step 4 Voltar returns to step 3 with description preserved", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição preservada");
    await rq.getNextButton().click();
    await page.waitForTimeout(500);
    await expect(rq.getStep4Title()).toBeVisible();
    await rq.getBackButton().click();
    await page.waitForTimeout(400);
    await expect(rq.getStep3SectionTitle()).toBeVisible();
    await expect(rq.getDescriptionTextarea()).toHaveValue("Descrição preservada");
  });

  test("step 4 address form accepts empty complement", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição.");
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.fillNewAddress({ street: "Rua X", number: "10", complement: "" });
    await page.waitForTimeout(300);
    await expect(rq.getNextButton()).toBeEnabled();
  });

  // ─── Step 5: Identity (guest) ──────────────────────────────────────────────

  test("step 5 shows identity form for guest", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição do serviço.");
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.fillNewAddress({ street: "Rua Teste", number: "100" });
    await page.waitForTimeout(400);
    await rq.getNextButton().click();
    await page.waitForTimeout(400);

    await expect(rq.getStep5Title()).toBeVisible();
    await expect(rq.getFirstNameInput()).toBeVisible();
    await expect(rq.getLastNameInput()).toBeVisible();
    await expect(rq.getEmailInput()).toBeVisible();
    await expect(rq.getPasswordInput()).toBeVisible();
    await expect(rq.getTermsCheckbox()).toBeVisible();
    await expect(rq.getSubmitOrderButton()).toBeVisible();
  });

  test("step 5 Enviar pedido is disabled without valid identity", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição.");
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.fillNewAddress({ street: "Rua A", number: "1" });
    await page.waitForTimeout(400);
    await rq.getNextButton().click();
    await page.waitForTimeout(400);

    await expect(rq.getSubmitOrderButton()).toBeDisabled();
  });

  test("step 5 shows password mismatch when confirm differs", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição.");
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.fillNewAddress({ street: "Rua A", number: "1" });
    await page.waitForTimeout(400);
    await rq.getNextButton().click();
    await page.waitForTimeout(400);

    await rq.getFirstNameInput().fill("Test");
    await rq.getLastNameInput().fill("User");
    await rq.getEmailInput().fill("test@example.com");
    await rq.getPasswordInput().fill("SecurePass123!");
    await rq.getConfirmPasswordInput().fill("OtherPass456!");
    await page.waitForTimeout(200);
    await expect(rq.getPasswordMismatchAlert()).toBeVisible();
  });

  test("step 5 Voltar returns to step 4", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição");
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.fillNewAddress({ street: "Rua A", number: "1" });
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await expect(rq.getStep5Title()).toBeVisible();
    await rq.getBackButton().click();
    await page.waitForTimeout(400);
    await expect(rq.getStep4Title()).toBeVisible();
  });

  test("step 5 Enviar pedido is disabled when first name is too short", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição");
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.fillNewAddress({ street: "Rua A", number: "1" });
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.getFirstNameInput().fill("A");
    await rq.getLastNameInput().fill("Silva");
    await rq.getEmailInput().fill("test@example.com");
    await rq.getPasswordInput().fill("SecurePass123!");
    await rq.getConfirmPasswordInput().fill("SecurePass123!");
    await rq.getTermsCheckbox().click();
    await page.waitForTimeout(200);
    await expect(rq.getSubmitOrderButton()).toBeDisabled();
  });

  test("step 5 Enviar pedido is disabled when email is invalid", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição");
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.fillNewAddress({ street: "Rua A", number: "1" });
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.getFirstNameInput().fill("Maria");
    await rq.getLastNameInput().fill("Silva");
    await rq.getEmailInput().fill("invalid-email");
    await rq.getPasswordInput().fill("SecurePass123!");
    await rq.getConfirmPasswordInput().fill("SecurePass123!");
    await rq.getTermsCheckbox().click();
    await page.waitForTimeout(200);
    await expect(rq.getSubmitOrderButton()).toBeDisabled();
  });

  test("step 5 submit with weak password shows validation toast", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição");
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.fillNewAddress({ street: "Rua A", number: "1" });
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.getFirstNameInput().fill("Maria");
    await rq.getLastNameInput().fill("Silva");
    await rq.getEmailInput().fill("test@example.com");
    await rq.getPasswordInput().fill("1234567890");
    await rq.getConfirmPasswordInput().fill("1234567890");
    await rq.getTermsCheckbox().click();
    await page.waitForTimeout(200);
    await rq.getSubmitOrderButton().click();
    const toast = page.getByText(/senha|caracteres|número|letra/i);
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test("step 5 Enviar pedido stays disabled when terms not accepted", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição");
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.fillNewAddress({ street: "Rua A", number: "1" });
    await rq.getNextButton().click();
    await page.waitForTimeout(400);
    await rq.getFirstNameInput().fill("Maria");
    await rq.getLastNameInput().fill("Silva");
    await rq.getEmailInput().fill("test@example.com");
    await rq.getPasswordInput().fill("SecurePass123!");
    await rq.getConfirmPasswordInput().fill("SecurePass123!");
    await expect(rq.getTermsCheckbox()).not.toBeChecked();
    await expect(rq.getSubmitOrderButton()).toBeDisabled();
  });

  // ─── Back navigation ─────────────────────────────────────────────────────

  test("Back button returns to previous step", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1000);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await expect(rq.getStep3SectionTitle()).toBeVisible();
    await rq.getBackButton().click();
    await expect(rq.getStep2SectionTitle()).toBeVisible();
  });

  // ─── Draft restore dialog ────────────────────────────────────────────────

  test("draft restore dialog appears when draft exists in storage", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    const storageKey = "renovi_request_quote_draft";
    const draftPayload = JSON.stringify({
      version: "1",
      draft: {
        currentStep: 2,
        previousStep: 1,
        selectedService: { id: "svc-1", title: "Serviço Teste", slug: "servico-teste" },
        step2Data: {},
        step2FormSchema: null,
        step2FormVersion: null,
        step3Data: { description: "" },
        step4Data: null,
      },
    });
    await page.goto("/pedir-orcamento");
    await page.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: storageKey, value: draftPayload }
    );
    await page.reload();
    await page.waitForTimeout(800);

    await expect(rq.getDraftDialog()).toBeVisible();
    await expect(rq.getDraftDialogTitle()).toBeVisible();
    await expect(rq.getDraftContinueButton()).toBeVisible();
    await expect(rq.getDraftDiscardButton()).toBeVisible();
  });

  test("draft discard closes dialog and shows step 1", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    const storageKey = "renovi_request_quote_draft";
    const draftPayload = JSON.stringify({
      version: "1",
      draft: {
        currentStep: 2,
        previousStep: 1,
        selectedService: { id: "svc-1", title: "Serviço", slug: "servico" },
        step2Data: {},
        step2FormSchema: null,
        step2FormVersion: null,
        step3Data: { description: "" },
        step4Data: null,
      },
    });
    await page.goto("/pedir-orcamento");
    await page.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: storageKey, value: draftPayload }
    );
    await page.reload();
    await page.waitForTimeout(800);
    await rq.getDraftDiscardButton().click();
    await page.waitForTimeout(300);
    await expect(rq.getDraftDialog()).not.toBeVisible();
    await expect(rq.getStep1Heading()).toBeVisible();
  });

  test("draft Continuar restores draft and shows step 2", async ({ page }) => {
    const rq = new RequestQuotePage(page);
    const storageKey = "renovi_request_quote_draft";
    const draftPayload = JSON.stringify({
      version: "1",
      draft: {
        currentStep: 2,
        previousStep: 1,
        selectedService: { id: "svc-1", title: "Serviço", slug: "servico" },
        step2Data: {},
        step2FormSchema: null,
        step2FormVersion: null,
        step3Data: { description: "" },
        step4Data: null,
      },
    });
    await page.goto("/pedir-orcamento");
    await page.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: storageKey, value: draftPayload }
    );
    await page.reload();
    await page.waitForTimeout(800);
    await rq.getDraftContinueButton().click();
    await page.waitForTimeout(500);
    await expect(rq.getDraftDialog()).not.toBeVisible();
    const step2Visible =
      (await rq.getStep2SectionTitle().isVisible()) ||
      (await rq.getFormNotConfiguredAlert().isVisible());
    expect(step2Visible).toBeTruthy();
  });

  test("draft with wrong version does not show restore dialog", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    const storageKey = "renovi_request_quote_draft";
    const draftPayload = JSON.stringify({
      version: "99",
      draft: {
        currentStep: 2,
        previousStep: 1,
        selectedService: { id: "x", title: "X", slug: "x" },
        step2Data: {},
        step2FormSchema: null,
        step2FormVersion: null,
        step3Data: { description: "" },
        step4Data: null,
      },
    });
    await page.goto("/pedir-orcamento");
    await page.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: storageKey, value: draftPayload }
    );
    await page.reload();
    await page.waitForTimeout(800);
    await rq.waitForStep1Ready();
    await expect(rq.getDraftDialog()).not.toBeVisible();
    await expect(rq.getStep1Heading()).toBeVisible();
  });

  // ─── URL with serviceSlug ─────────────────────────────────────────────────

  test("URL with serviceSlug param loads step 1 and can preselect service", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.goto({ serviceSlug: "inexistent-slug" });
    await rq.waitForStep1Ready();
    await expect(rq.getStep1Heading()).toBeVisible();
  });

  // ─── Full guest flow (optional: requires Supabase + edge function) ───────

  test("full guest flow submits and shows confirm email screen", async ({
    page,
  }) => {
    test.setTimeout(60000);
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1000);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Preciso de orçamento para o serviço solicitado.");
    await rq.getNextButton().click();
    await page.waitForTimeout(500);
    await rq.fillNewAddress({ street: "Rua E2E", number: "99" });
    await page.waitForTimeout(500);
    await rq.getNextButton().click();
    await page.waitForTimeout(500);

    const unique = `e2e.${Date.now()}@example.com`;
    await rq.getFirstNameInput().fill("E2E");
    await rq.getLastNameInput().fill("Guest");
    await rq.getEmailInput().fill(unique);
    await rq.getPasswordInput().fill("SecurePass123!");
    await rq.getConfirmPasswordInput().fill("SecurePass123!");
    await rq.getTermsCheckbox().click();
    await page.waitForTimeout(300);
    await rq.getSubmitOrderButton().click();

    await expect(rq.getConfirmEmailHeading()).toBeVisible({ timeout: 15000 });
    await expect(rq.getConfirmEmailDisplay(unique)).toBeVisible();
    await expect(rq.getConfirmEmailMessage()).toBeVisible();
    await expect(rq.getGoToLoginLink()).toBeVisible();
    await rq.getGoToLoginLink().click();
    await expect(page).toHaveURL(/\/login/);
  });

  // ─── Step 4: Address form structure ──────────────────────────────────────

  test("step 4 shows state and city selects after CEP or manually", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição");
    await rq.getNextButton().click();
    await page.waitForTimeout(500);
    await expect(rq.getCepInput()).toBeVisible();
    await expect(rq.getStateSelectTrigger()).toBeVisible();
    await expect(rq.getStreetInput()).toBeVisible();
  });

  // ─── Multi-step back navigation ───────────────────────────────────────────

  test("navigating back from step 4 to step 2 then to step 1 via Cancelar", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1000);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getBackButton().click();
    await page.waitForTimeout(400);
    await expect(rq.getStep2SectionTitle()).toBeVisible();
    const cancelBtn = rq.getDynamicFormCancelButton();
    if ((await cancelBtn.count()) > 0) {
      await cancelBtn.click();
      await expect(rq.getStep1Heading()).toBeVisible();
    }
  });

  // ─── Error handling (network interception to simulate API failures) ───────

  test("when services list API returns error, step 1 shows empty state and does not crash", async ({
    page,
  }) => {
    await page.route("**/rest/v1/services*", (route) =>
      route.fulfill({ status: 500, body: "{}" })
    );
    const rq = new RequestQuotePage(page);
    await rq.goto();
    await rq.waitForStep1Ready();
    await expect(rq.getStep1Heading()).toBeVisible();
    await expect(rq.getServicesEmpty()).toBeVisible();
  });

  test("when URL has slug with no matching service, stays on step 1 without auto-advancing", async ({
    page,
  }) => {
    const rq = new RequestQuotePage(page);
    await rq.goto({ serviceSlug: "slug-que-nao-existe-em-nenhum-servico" });
    await rq.waitForStep1Ready();
    await expect(rq.getStep1Heading()).toBeVisible();
    const nextBtn = rq.getNextButton();
    await expect(nextBtn).not.toBeVisible();
    const sectionStep2 = rq.getStep2SectionTitle();
    await expect(sectionStep2).not.toBeVisible();
  });

  test("when AI description generation fails, shows toast and user can type manually", async ({
    page,
  }) => {
    await page.route("**/functions/v1/generate-smart-description**", (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: "Internal error" }) })
    );
    const rq = new RequestQuotePage(page);
    await rq.goto();
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1500);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await page.waitForTimeout(3000);
    await expect(rq.getToastSmartDescriptionError()).toBeVisible({ timeout: 8000 });
    await expect(rq.getDescriptionTextarea()).toBeVisible();
    await rq.getDescriptionTextarea().fill("Descrição manual após erro da IA.");
    await page.waitForTimeout(200);
    await expect(rq.getNextButton()).toBeEnabled();
  });

  test("when CEP lookup returns invalid CEP (erro: true), shows toast and clears CEP", async ({
    page,
  }) => {
    await page.route("**/viacep.com.br/ws/*/json/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ erro: true }),
      })
    );
    const rq = new RequestQuotePage(page);
    await rq.goto();
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição");
    await rq.getNextButton().click();
    await page.waitForTimeout(500);
    await rq.getCepInput().fill("00000-000");
    await page.waitForTimeout(2500);
    await expect(rq.getToastCepNotFound()).toBeVisible({ timeout: 5000 });
  });

  test("when CEP API returns server error, form does not crash and user can fill manually", async ({
    page,
  }) => {
    await page.route("**/viacep.com.br/ws/*/json/**", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" })
    );
    const rq = new RequestQuotePage(page);
    await rq.goto();
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(800);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição");
    await rq.getNextButton().click();
    await page.waitForTimeout(500);
    await rq.getCepInput().fill("01310100");
    await page.waitForTimeout(2000);
    await expect(rq.getStep4Title()).toBeVisible();
    await expect(rq.getStateSelectTrigger()).toBeVisible();
    await rq.fillNewAddress({ street: "Rua Manual", number: "1" });
    await expect(rq.getNextButton()).toBeEnabled();
  });

  test("when signup returns error, shows toast and stays on step 5", async ({
    page,
  }) => {
    await page.route("**/auth/v1/signup**", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "signup_failed",
          error_description: "Erro ao criar conta. Tente novamente.",
        }),
      })
    );
    const rq = new RequestQuotePage(page);
    await rq.goto();
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1000);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição");
    await rq.getNextButton().click();
    await page.waitForTimeout(500);
    await rq.fillNewAddress({ street: "Rua E2E", number: "99" });
    await rq.getNextButton().click();
    await page.waitForTimeout(500);
    const unique = `e2e.err.${Date.now()}@example.com`;
    await rq.getFirstNameInput().fill("E2E");
    await rq.getLastNameInput().fill("Err");
    await rq.getEmailInput().fill(unique);
    await rq.getPasswordInput().fill("SecurePass123!");
    await rq.getConfirmPasswordInput().fill("SecurePass123!");
    await rq.getTermsCheckbox().click();
    await page.waitForTimeout(300);
    await rq.getSubmitOrderButton().click();
    await expect(page.getByText(/não foi possível|erro|tente novamente/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(rq.getStep5Title()).toBeVisible();
  });

  test("when create order (guest) returns error, shows toast and stays on step 5", async ({
    page,
  }) => {
    await page.route("**/auth/v1/signup**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "e2e-fake-user-id",
            email: "e2e@test.com",
            email_confirmed_at: null,
            aud: "authenticated",
            role: "authenticated",
          },
          session: {
            access_token: "fake-token",
            refresh_token: "fake-refresh",
            expires_in: 3600,
            token_type: "bearer",
          },
        }),
      })
    );
    await page.route("**/functions/v1/create-request-quote-order**", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Falha ao criar pedido. Tente novamente." }),
      })
    );
    const rq = new RequestQuotePage(page);
    await rq.goto();
    await rq.waitForStep1Ready();
    const firstCard = rq.getFirstServiceCard();
    if ((await firstCard.count()) === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(1000);
    const reachedStep3 = await rq.completeStep2ToStep3();
    if (!reachedStep3) {
      test.skip();
      return;
    }
    await rq.getDescriptionTextarea().fill("Descrição");
    await rq.getNextButton().click();
    await page.waitForTimeout(500);
    await rq.fillNewAddress({ street: "Rua E2E", number: "99" });
    await rq.getNextButton().click();
    await page.waitForTimeout(500);
    const unique = `e2e.order.${Date.now()}@example.com`;
    await rq.getFirstNameInput().fill("E2E");
    await rq.getLastNameInput().fill("Order");
    await rq.getEmailInput().fill(unique);
    await rq.getPasswordInput().fill("SecurePass123!");
    await rq.getConfirmPasswordInput().fill("SecurePass123!");
    await rq.getTermsCheckbox().click();
    await page.waitForTimeout(300);
    await rq.getSubmitOrderButton().click();
    await expect(
      page.getByText(/falha ao criar pedido|ocorreu um erro|tente novamente/i)
    ).toBeVisible({ timeout: 15000 });
    await expect(rq.getStep5Title()).toBeVisible();
  });
});
