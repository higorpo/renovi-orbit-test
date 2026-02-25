import { test, expect } from "../fixtures/auth.fixture";
import { LoginPage } from "../pages/login.page";

test.describe("Login Page", () => {
  // ─── Layout & Rendering ──────────────────────────────────────────────

  test("renders all essential elements", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const login = new LoginPage(page);
    await login.goto();

    await expect(login.heading).toBeVisible();
    await expect(login.subtitle).toBeVisible();
    await expect(login.emailInput).toBeVisible();
    await expect(login.passwordInput).toBeVisible();
    await expect(login.submitButton).toBeVisible();
    await expect(login.forgotPasswordLink).toBeVisible();
    await expect(login.clientSignupLink).toBeVisible();
    await expect(login.providerSignupLink).toBeVisible();
    await expect(login.logo).toBeVisible();
    await expect(login.rememberMeCheckbox).toBeVisible();
  });

  test("password input starts as type=password", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const login = new LoginPage(page);
    await login.goto();

    await expect(login.passwordInput).toHaveAttribute("type", "password");
  });

  test("toggle password visibility works", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const login = new LoginPage(page);
    await login.goto();

    await login.fillPassword("test123");
    await login.togglePasswordButton.click();
    await expect(login.passwordInput).toHaveAttribute("type", "text");

    await login.togglePasswordButton.click();
    await expect(login.passwordInput).toHaveAttribute("type", "password");
  });

  // ─── Validation ──────────────────────────────────────────────────────

  test("shows validation error for empty fields on submit", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const login = new LoginPage(page);
    await login.goto();

    await login.submit();

    await expect(page.locator(".text-red-400").first()).toBeVisible();
  });

  test("browser prevents submission with invalid email (native validation)", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const login = new LoginPage(page);
    await login.goto();

    await login.fillEmail("invalid-email");
    await login.fillPassword("somepassword");
    await login.submit();

    // The browser's native type="email" validation prevents submission;
    // the form should NOT have fired a network request.
    await page.waitForTimeout(300);
    const emailInput = login.emailInput;
    const validity = await emailInput.evaluate(
      (el) => (el as HTMLInputElement).validity.valid
    );
    expect(validity).toBe(false);
  });

  // ─── Successful Login ────────────────────────────────────────────────

  test("successful login sends correct request body", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    const mocks = await mockSupabaseAsGuest();
    const login = new LoginPage(page);
    await login.goto();

    await login.login("user@test.com", "SecurePass123!");

    // Wait for the request to be captured
    await page.waitForTimeout(500);

    expect(mocks.capturedRequests.signIn.length).toBeGreaterThanOrEqual(1);
    const body = mocks.capturedRequests.signIn[0] as Record<string, string>;
    expect(body.email).toBe("user@test.com");
    expect(body.password).toBe("SecurePass123!");
  });

  test("shows loading state during login", async ({ page, mockSupabaseAsGuest }) => {
    const mocks = await mockSupabaseAsGuest();

    // Slow down the response so we can observe loading state
    mocks.onSignIn(async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock",
          user: {
            id: "1",
            email: "user@test.com",
            aud: "authenticated",
            role: "authenticated",
            user_metadata: { full_name: "Test", role: "client" },
            identities: [{ id: "1", provider: "email" }],
          },
        }),
      });
    });

    const login = new LoginPage(page);
    await login.goto();

    await login.fillEmail("user@test.com");
    await login.fillPassword("SecurePass123!");
    await login.submit();

    await expect(page.getByText("Entrando...")).toBeVisible();
  });

  test("invalid credentials show error toast", async ({ page, mockSupabaseAsGuest }) => {
    const mocks = await mockSupabaseAsGuest();

    mocks.onSignIn(async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        }),
      });
    });

    const login = new LoginPage(page);
    await login.goto();

    await login.login("wrong@test.com", "WrongPass123!");

    await expect(page.getByText("Não foi possível entrar")).toBeVisible({ timeout: 5000 });
  });

  // ─── Navigation ──────────────────────────────────────────────────────

  test("forgot password link navigates to /esqueceu-senha", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const login = new LoginPage(page);
    await login.goto();

    await login.forgotPasswordLink.click();
    await expect(page).toHaveURL(/\/esqueceu-senha/);
  });

  test("client signup link navigates to /cadastro/cliente", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const login = new LoginPage(page);
    await login.goto();

    await login.clientSignupLink.click();
    await expect(page).toHaveURL(/\/cadastro\/cliente/);
  });

  test("provider signup link navigates to /cadastro/profissional", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    const login = new LoginPage(page);
    await login.goto();

    await login.providerSignupLink.click();
    await expect(page).toHaveURL(/\/cadastro\/profissional/);
  });

  // ─── Accessibility ───────────────────────────────────────────────────

  test("form inputs have proper labels", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    const login = new LoginPage(page);
    await login.goto();

    await expect(page.getByLabel("Email")).toBeVisible();
    // Use the label-for attribute association instead of getByLabel
    // to avoid matching the toggle button whose aria-label contains "senha"
    const passwordLabel = page.locator("label[for='password']");
    await expect(passwordLabel).toBeVisible();
    await expect(passwordLabel).toHaveText("Senha");
  });

  test("submit button is disabled while submitting", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    const mocks = await mockSupabaseAsGuest();

    mocks.onSignIn(async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    const login = new LoginPage(page);
    await login.goto();

    await login.fillEmail("user@test.com");
    await login.fillPassword("SecurePass123!");
    await login.submit();

    await expect(login.submitButton).toBeDisabled();
  });
});
