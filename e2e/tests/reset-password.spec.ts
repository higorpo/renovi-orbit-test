import { test, expect } from "../fixtures/auth.fixture";
import { ResetPasswordPage } from "../pages/reset-password.page";
import { createMockUser, createMockProfile } from "../mocks/supabase.mock";

const VALID_PASSWORD = "Str0ng!Pass@2024";

test.describe("Reset Password", () => {
  // ─── Non-recovery mode (no active session) ───────────────────────────

  test("shows 'request new link' screen when user is not authenticated", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const reset = new ResetPasswordPage(page);
    await reset.goto();

    await expect(reset.nonRecoveryHeading).toBeVisible();
    await expect(reset.requestNewLinkButton).toBeVisible();
    await expect(reset.nonRecoveryLoginLink).toBeVisible();
  });

  test("'Solicitar novo link' navigates to forgot-password", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const reset = new ResetPasswordPage(page);
    await reset.goto();

    await reset.requestNewLinkButton.click();
    await expect(page).toHaveURL(/\/esqueceu-senha/);
  });

  test("'Voltar para o login' link works", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const reset = new ResetPasswordPage(page);
    await reset.goto();

    await reset.nonRecoveryLoginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  // ─── Recovery mode (authenticated via recovery link) ──────────────────

  test("shows password form when user is authenticated", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser();
    await seedSession(user);
    await mockSupabaseAsUser(user, createMockProfile({ id: user.id }));

    const reset = new ResetPasswordPage(page);
    await reset.goto();

    await expect(reset.heading).toBeVisible({ timeout: 10000 });
    await expect(reset.passwordInput).toBeVisible();
    await expect(reset.confirmPasswordInput).toBeVisible();
    await expect(reset.submitButton).toBeVisible();
  });

  test("shows password strength indicator", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser();
    await seedSession(user);
    await mockSupabaseAsUser(user, createMockProfile({ id: user.id }));

    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await reset.heading.waitFor({ state: "visible", timeout: 10000 });

    await reset.passwordInput.fill("Ab1!");
    await expect(reset.getPasswordStrengthLabel()).toBeVisible();
  });

  test("shows password requirements checklist", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser();
    await seedSession(user);
    await mockSupabaseAsUser(user, createMockProfile({ id: user.id }));

    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await reset.heading.waitFor({ state: "visible", timeout: 10000 });

    await reset.passwordInput.fill("a");

    await expect(reset.getPasswordRequirement("Mínimo 10 caracteres")).toBeVisible();
    await expect(reset.getPasswordRequirement("1 letra maiúscula")).toBeVisible();
    await expect(reset.getPasswordRequirement("1 número")).toBeVisible();
  });

  // ─── Validation ──────────────────────────────────────────────────────

  test("validates weak password", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser();
    await seedSession(user);
    await mockSupabaseAsUser(user, createMockProfile({ id: user.id }));

    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await reset.heading.waitFor({ state: "visible", timeout: 10000 });

    await reset.submitNewPassword("short", "short");

    await expect(reset.getFieldError()).toBeVisible();
  });

  test("validates password mismatch", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser();
    await seedSession(user);
    await mockSupabaseAsUser(user, createMockProfile({ id: user.id }));

    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await reset.heading.waitFor({ state: "visible", timeout: 10000 });

    await reset.submitNewPassword(VALID_PASSWORD, "DifferentPass123!");

    await expect(page.getByText("As senhas não coincidem")).toBeVisible();
  });

  // ─── Successful Reset ────────────────────────────────────────────────

  test("successful reset sends correct request body", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser();
    await seedSession(user);
    const mocks = await mockSupabaseAsUser(user, createMockProfile({ id: user.id }));

    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await reset.heading.waitFor({ state: "visible", timeout: 10000 });

    await reset.submitNewPassword(VALID_PASSWORD, VALID_PASSWORD);

    await page.waitForTimeout(1000);

    expect(mocks.capturedRequests.updateUser.length).toBeGreaterThanOrEqual(1);
    const body = mocks.capturedRequests.updateUser[0] as Record<string, string>;
    expect(body.password).toBe(VALID_PASSWORD);
  });

  test("successful reset navigates to login", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser();
    await seedSession(user);
    await mockSupabaseAsUser(user, createMockProfile({ id: user.id }));

    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await reset.heading.waitFor({ state: "visible", timeout: 10000 });

    await reset.submitNewPassword(VALID_PASSWORD, VALID_PASSWORD);

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  // ─── Error Handling ──────────────────────────────────────────────────

  test("shows error when new password is same as current", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser();
    await seedSession(user);
    const mocks = await mockSupabaseAsUser(user, createMockProfile({ id: user.id }));

    mocks.onUpdateUser(async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: "same_password",
          message: "New password should be different from the old password.",
        }),
      });
    });

    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await reset.heading.waitFor({ state: "visible", timeout: 10000 });

    await reset.submitNewPassword(VALID_PASSWORD, VALID_PASSWORD);

    await expect(
      page.getByText(/diferente da senha atual|should be different/i)
    ).toBeVisible({ timeout: 5000 });
  });

  // ─── Loading State ───────────────────────────────────────────────────

  test("submit button shows loading during submission", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser();
    await seedSession(user);
    const mocks = await mockSupabaseAsUser(user, createMockProfile({ id: user.id }));

    mocks.onUpdateUser(async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: user.id }),
      });
    });

    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await reset.heading.waitFor({ state: "visible", timeout: 10000 });

    await reset.passwordInput.fill(VALID_PASSWORD);
    await reset.confirmPasswordInput.fill(VALID_PASSWORD);
    await reset.submitButton.click();

    await expect(page.getByText("Salvando...")).toBeVisible();
  });
});
