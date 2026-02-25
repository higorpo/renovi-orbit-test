import { test, expect } from "../fixtures/auth.fixture";
import { ForgotPasswordPage } from "../pages/forgot-password.page";

test.describe("Forgot Password", () => {
  // ─── Layout & Rendering ──────────────────────────────────────────────

  test("renders all essential elements", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();

    await expect(forgot.heading).toBeVisible();
    await expect(forgot.subtitle).toBeVisible();
    await expect(forgot.emailInput).toBeVisible();
    await expect(forgot.submitButton).toBeVisible();
    await expect(forgot.loginLink).toBeVisible();
    await expect(forgot.logo).toBeVisible();
  });

  // ─── Validation ──────────────────────────────────────────────────────

  test("shows validation error for empty email", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();

    await forgot.submit();

    await expect(forgot.getFieldError()).toBeVisible();
  });

  test("browser prevents submission with invalid email (native validation)", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();

    await forgot.fillEmail("not-an-email");
    await forgot.submit();

    await page.waitForTimeout(300);
    const validity = await forgot.emailInput.evaluate(
      (el) => (el as HTMLInputElement).validity.valid
    );
    expect(validity).toBe(false);
  });

  // ─── Successful Request ──────────────────────────────────────────────

  test("successful submission shows success screen", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();

    await forgot.requestReset("user@test.com");

    await expect(
      page.getByRole("heading", { name: "Email enviado!" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("sends correct request body", async ({ page, mockSupabaseAsGuest }) => {
    const mocks = await mockSupabaseAsGuest();
    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();

    await forgot.requestReset("user@test.com");
    await page.waitForTimeout(500);

    expect(mocks.capturedRequests.recover.length).toBeGreaterThanOrEqual(1);
    const body = mocks.capturedRequests.recover[0] as Record<string, string>;
    expect(body.email).toBe("user@test.com");
  });

  test("sends redirectTo pointing to /recuperar-senha", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    const mocks = await mockSupabaseAsGuest();
    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();

    await forgot.requestReset("user@test.com");
    await page.waitForTimeout(500);

    // Supabase JS sends redirect_to as a URL query parameter
    expect(mocks.capturedUrls.recover.length).toBeGreaterThanOrEqual(1);
    const url = decodeURIComponent(mocks.capturedUrls.recover[0]);
    expect(url).toContain("/recuperar-senha");
  });

  // ─── Error Handling ──────────────────────────────────────────────────

  test("API error shows error message in form or toast", async ({ page, mockSupabaseAsGuest }) => {
    const mocks = await mockSupabaseAsGuest();

    mocks.onRecover(async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: "validation_failed",
          message: "Unable to validate email address: invalid format",
        }),
      });
    });

    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();

    await forgot.requestReset("valid@format.com");

    // Error appears either in the form field or as a toast
    await expect(
      page.getByText(/Unable to validate|Erro ao processar/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows loading state during submission", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    const mocks = await mockSupabaseAsGuest();

    mocks.onRecover(async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();

    await forgot.fillEmail("user@test.com");
    await forgot.submit();

    await expect(page.getByText("Enviando...")).toBeVisible();
  });

  // ─── Navigation ──────────────────────────────────────────────────────

  test("login link navigates to /login", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();

    await forgot.loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  // ─── Accessibility ───────────────────────────────────────────────────

  test("email input has proper label", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();

    const label = page.locator("label[for='email']");
    await expect(label).toBeVisible();
  });

  test("submit button is disabled while submitting", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    const mocks = await mockSupabaseAsGuest();

    mocks.onRecover(async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();

    await forgot.fillEmail("user@test.com");
    await forgot.submit();

    await expect(forgot.submitButton).toBeDisabled();
  });
});
