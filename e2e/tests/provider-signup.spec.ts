import { test, expect } from "../fixtures/auth.fixture";
import { ProviderSignupPage } from "../pages/provider-signup.page";

const VALID_PASSWORD = "Str0ng!Pass@2024";

test.describe("Provider Signup", () => {
  // ─── Layout ──────────────────────────────────────────────────────────

  test("renders step 0 with name and email fields", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ProviderSignupPage(page);
    await signup.goto();

    await expect(signup.fullNameInput).toBeVisible();
    await expect(signup.emailInput).toBeVisible();
    await expect(signup.continueButton).toBeVisible();
    await expect(signup.logo).toBeVisible();
  });

  // ─── Validation ──────────────────────────────────────────────────────

  test("step 0 validates single name (requires at least first and last name)", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ProviderSignupPage(page);
    await signup.goto();

    await signup.fullNameInput.fill("Provider");
    await signup.emailInput.fill("pro@test.com");
    await signup.continueButton.click();

    await expect(page.getByText("Informe nome e sobrenome")).toBeVisible();
  });

  test("step 0 validates empty name", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const signup = new ProviderSignupPage(page);
    await signup.goto();

    await signup.emailInput.fill("pro@test.com");
    await signup.continueButton.click();

    await expect(page.getByText("Nome é obrigatório")).toBeVisible();
  });

  test("step 0 validates invalid email", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const signup = new ProviderSignupPage(page);
    await signup.goto();

    await signup.fullNameInput.fill("Provider Test");
    await signup.emailInput.fill("bad-email");
    await signup.continueButton.click();

    await expect(page.getByText("Email inválido")).toBeVisible();
  });

  test("step 1 validates password mismatch", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const signup = new ProviderSignupPage(page);
    await signup.goto();

    await signup.advanceToStep1("Provider Test", "pro@test.com");
    await signup.fillStep1(VALID_PASSWORD, "DifferentPass123!");
    await signup.continueButton.click();

    await expect(page.getByText("As senhas não coincidem")).toBeVisible();
  });

  // ─── Step navigation ─────────────────────────────────────────────────

  test("can navigate back from step 1 to step 0", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ProviderSignupPage(page);
    await signup.goto();

    await signup.advanceToStep1("Provider Test", "pro@test.com");
    await signup.backButton.click();

    await expect(signup.fullNameInput).toBeVisible();
    await expect(signup.fullNameInput).toHaveValue("Provider Test");
  });

  // ─── Step 2: confirmation with provider-specific content ─────────────

  test("step 2 shows provider-specific terms", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ProviderSignupPage(page);
    await signup.goto();

    await signup.advanceToStep2("Provider Test", "pro@test.com", VALID_PASSWORD, VALID_PASSWORD);

    await expect(signup.termsCheckbox).toBeVisible();
    // Provider-specific terms links
    await expect(page.getByText(/Termos de Uso/)).toBeVisible();
  });

  // ─── Successful Signup ───────────────────────────────────────────────

  test("successful signup shows confirmation screen", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ProviderSignupPage(page);
    await signup.goto();

    await signup.completeSignup("Provider Test", "pro@test.com", VALID_PASSWORD, VALID_PASSWORD);

    await expect(signup.getSuccessMessage()).toBeVisible({ timeout: 5000 });
  });

  test("signup sends correct request body with role=provider", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    const mocks = await mockSupabaseAsGuest();
    const signup = new ProviderSignupPage(page);
    await signup.goto();

    await signup.completeSignup("Provider Test", "pro@test.com", VALID_PASSWORD, VALID_PASSWORD);

    await expect(signup.getSuccessMessage()).toBeVisible({ timeout: 10000 });

    expect(mocks.capturedRequests.signUp.length).toBeGreaterThanOrEqual(1);
    const body = mocks.capturedRequests.signUp[0] as Record<string, unknown>;
    expect(body.email).toBe("pro@test.com");
    expect(body.password).toBe(VALID_PASSWORD);

    const data = (body.data ?? body.options?.data) as Record<string, string> | undefined;
    expect(data?.role).toBe("provider");
    expect(data?.full_name).toBe("Provider Test");
  });

  // ─── Error Scenarios ─────────────────────────────────────────────────

  test("duplicate email shows error toast", async ({ page, mockSupabaseAsGuest }) => {
    const mocks = await mockSupabaseAsGuest();

    mocks.onSignUp(async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "user-id",
          aud: "authenticated",
          role: "authenticated",
          email: "existing@test.com",
          identities: [],
          user_metadata: {},
          app_metadata: { provider: "email", providers: ["email"] },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    });

    const signup = new ProviderSignupPage(page);
    await signup.goto();

    await signup.completeSignup("Provider Test", "existing@test.com", VALID_PASSWORD, VALID_PASSWORD);

    await expect(
      page.getByText(/Este email já está cadastrado/)
    ).toBeVisible({ timeout: 10000 });
  });
});
