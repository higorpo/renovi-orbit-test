import { test, expect } from "../fixtures/auth.fixture";
import { ClientSignupPage } from "../pages/client-signup.page";

const VALID_PASSWORD = "Str0ng!Pass@2024";
const WEAK_PASSWORD = "weak";

/** Shape of POST /auth/v1/signup body captured by Supabase mocks */
type CapturedSignUpBody = {
  email?: string;
  password?: string;
  data?: Record<string, string>;
  options?: { data?: Record<string, string> };
};

test.describe("Client Signup", () => {
  // ─── Step 0: Basic Info ──────────────────────────────────────────────

  test("renders step 0 with name and email fields", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();

    await expect(signup.fullNameInput).toBeVisible();
    await expect(signup.emailInput).toBeVisible();
    await expect(signup.continueButton).toBeVisible();
    await expect(signup.logo).toBeVisible();
  });

  test("step 0 validates single name (requires at least first and last name)", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();

    await signup.fullNameInput.fill("João");
    await signup.emailInput.fill("test@test.com");
    await signup.clickContinue();

    await expect(page.getByText("Informe nome e sobrenome")).toBeVisible();
  });

  test("step 0 validates empty name", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();

    await signup.emailInput.fill("test@test.com");
    await signup.clickContinue();

    await expect(page.getByText("Nome é obrigatório")).toBeVisible();
  });

  test("step 0 validates invalid email", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();

    await signup.fullNameInput.fill("Test User");
    await signup.emailInput.fill("not-an-email");
    await signup.clickContinue();

    await expect(page.getByText("Email inválido")).toBeVisible();
  });

  test("step 0 advances to step 1 with valid data", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();

    await signup.advanceToStep1("João Silva", "joao@test.com");

    await expect(signup.passwordInput).toBeVisible();
    await expect(signup.confirmPasswordInput).toBeVisible();
  });

  // ─── Step 1: Password ────────────────────────────────────────────────

  test("step 1 shows password strength indicator", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();
    await signup.advanceToStep1("João Silva", "joao@test.com");

    await signup.passwordInput.fill("A");
    await expect(signup.getPasswordStrengthLabel()).toBeVisible();
  });

  test("step 1 shows password requirements checklist", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();
    await signup.advanceToStep1("João Silva", "joao@test.com");

    await signup.passwordInput.fill("a");

    await expect(signup.getPasswordRequirement("Mínimo 10 caracteres")).toBeVisible();
    await expect(signup.getPasswordRequirement("1 letra maiúscula")).toBeVisible();
    await expect(signup.getPasswordRequirement("1 letra minúscula")).toBeVisible();
    await expect(signup.getPasswordRequirement("1 número")).toBeVisible();
    await expect(signup.getPasswordRequirement("1 caractere especial")).toBeVisible();
  });

  test("step 1 validates weak password", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();
    await signup.advanceToStep1("João Silva", "joao@test.com");

    await signup.fillStep1(WEAK_PASSWORD, WEAK_PASSWORD);
    await signup.clickContinue();

    await expect(signup.getFieldError()).toBeVisible();
  });

  test("step 1 validates password mismatch", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();
    await signup.advanceToStep1("João Silva", "joao@test.com");

    await signup.fillStep1(VALID_PASSWORD, "DifferentPass123!");
    await signup.clickContinue();

    await expect(page.getByText("As senhas não coincidem")).toBeVisible();
  });

  test("step 1 back button returns to step 0", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();
    await signup.advanceToStep1("João Silva", "joao@test.com");

    await signup.backButton.click();

    await expect(signup.fullNameInput).toBeVisible();
    await expect(signup.fullNameInput).toHaveValue("João Silva");
  });

  // ─── Step 2: Confirmation ────────────────────────────────────────────

  test("step 2 shows review with user data", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();

    await signup.advanceToStep2("João Silva", "joao@test.com", VALID_PASSWORD, VALID_PASSWORD);

    await expect(signup.termsCheckbox).toBeVisible();
    await expect(page.getByText("João Silva")).toBeVisible();
    await expect(page.getByText("joao@test.com")).toBeVisible();
  });

  test("step 2 requires terms acceptance to enable submit", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();
    await signup.advanceToStep2("João Silva", "joao@test.com", VALID_PASSWORD, VALID_PASSWORD);

    await expect(signup.createAccountButton).toBeDisabled();

    await signup.termsCheckbox.click();
    await expect(signup.createAccountButton).toBeEnabled();
  });

  // ─── Successful Signup ───────────────────────────────────────────────

  test("successful signup shows confirmation screen", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();

    await signup.completeSignup("João Silva", "joao@test.com", VALID_PASSWORD, VALID_PASSWORD);

    await expect(signup.getSuccessMessage()).toBeVisible({ timeout: 5000 });
    await expect(signup.getConfirmationEmail("joao@test.com")).toBeVisible();
  });

  test("signup sends correct request body with role=client", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    const mocks = await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();

    await signup.completeSignup("João Silva", "joao@test.com", VALID_PASSWORD, VALID_PASSWORD);

    await expect(signup.getSuccessMessage()).toBeVisible({ timeout: 10000 });

    expect(mocks.capturedRequests.signUp.length).toBeGreaterThanOrEqual(1);
    const body = mocks.capturedRequests.signUp[0] as CapturedSignUpBody;
    expect(body.email).toBe("joao@test.com");
    expect(body.password).toBe(VALID_PASSWORD);

    // Supabase JS client sends user_metadata in body.data
    const data = body.data ?? body.options?.data;
    expect(data?.role).toBe("client");
    expect(data?.full_name).toBe("João Silva");
  });

  // ─── Error Scenarios ─────────────────────────────────────────────────

  test("duplicate email shows error toast", async ({ page, mockSupabaseAsGuest }) => {
    const mocks = await mockSupabaseAsGuest();

    // Simulate Supabase "email already registered": 200 with user that has empty identities
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

    const signup = new ClientSignupPage(page);
    await signup.goto();

    await signup.completeSignup("João Silva", "existing@test.com", VALID_PASSWORD, VALID_PASSWORD);

    await expect(
      page.getByText(/Este email já está cadastrado/)
    ).toBeVisible({ timeout: 10000 });
  });

  // ─── Multi-step navigation ───────────────────────────────────────────

  test("progress indicator reflects current step", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const signup = new ClientSignupPage(page);
    await signup.goto();

    // Step 0 - first step should be active (highlighted)
    const steps = page.locator(".rounded-full");
    await expect(steps.first()).toBeVisible();

    // Advance to step 1
    await signup.advanceToStep1("João Silva", "joao@test.com");
    await expect(signup.passwordInput).toBeVisible();

    // Advance to step 2
    await signup.fillStep1(VALID_PASSWORD, VALID_PASSWORD);
    await signup.clickContinue();
    await expect(signup.termsCheckbox).toBeVisible();
  });
});
