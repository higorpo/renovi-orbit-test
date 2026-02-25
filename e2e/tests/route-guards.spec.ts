import { test, expect } from "../fixtures/auth.fixture";
import { createMockUser, createMockProfile } from "../mocks/supabase.mock";

test.describe("Route Guards", () => {
  // ─── GuestOnlyRoute ──────────────────────────────────────────────────

  test("authenticated user is redirected away from /login", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser({ role: "client" });
    const profile = createMockProfile({ id: user.id, role: "client" });
    await seedSession(user);
    await mockSupabaseAsUser(user, profile);

    await page.goto("/login");

    // Should be redirected to dashboard
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("authenticated user is redirected away from /cadastro/cliente", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser({ role: "client" });
    const profile = createMockProfile({ id: user.id, role: "client" });
    await seedSession(user);
    await mockSupabaseAsUser(user, profile);

    await page.goto("/cadastro/cliente");

    await expect(page).not.toHaveURL(/\/cadastro\/cliente/, { timeout: 10000 });
  });

  test("authenticated user is redirected away from /esqueceu-senha", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser({ role: "client" });
    const profile = createMockProfile({ id: user.id, role: "client" });
    await seedSession(user);
    await mockSupabaseAsUser(user, profile);

    await page.goto("/esqueceu-senha");

    await expect(page).not.toHaveURL(/\/esqueceu-senha/, { timeout: 10000 });
  });

  // ─── ProtectedRoute ──────────────────────────────────────────────────

  test("unauthenticated user is redirected from protected route to /login", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();

    await page.goto("/example");

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("protected route preserves redirect URL", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();

    await page.goto("/example");

    await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 10000 });
  });

  // ─── Role-based access ───────────────────────────────────────────────

  test("provider user is redirected away from client-only route", async ({
    page,
    mockSupabaseAsUser,
    seedSession,
  }) => {
    const user = createMockUser({ role: "provider" });
    const profile = createMockProfile({ id: user.id, role: "provider" });
    await seedSession(user);
    await mockSupabaseAsUser(user, profile);

    await page.goto("/example");

    // /example requires role=client; provider should be redirected
    await expect(page).not.toHaveURL(/\/example$/, { timeout: 10000 });
  });

  // ─── Guest access to public routes ───────────────────────────────────

  test("guest can access /login", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("guest can access /cadastro/cliente", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    await page.goto("/cadastro/cliente");

    await expect(page.locator("#fullName")).toBeVisible({ timeout: 10000 });
  });

  test("guest can access /cadastro/profissional", async ({
    page,
    mockSupabaseAsGuest,
  }) => {
    await mockSupabaseAsGuest();
    await page.goto("/cadastro/profissional");

    await expect(page.locator("#fullName")).toBeVisible({ timeout: 10000 });
  });

  test("guest can access /esqueceu-senha", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    await page.goto("/esqueceu-senha");

    await expect(
      page.getByRole("heading", { name: "Esqueceu sua senha?" })
    ).toBeVisible({ timeout: 10000 });
  });

  test("guest can access /recuperar-senha", async ({ page, mockSupabaseAsGuest }) => {
    await mockSupabaseAsGuest();
    await page.goto("/recuperar-senha");

    // Should show the non-recovery mode (request new link)
    await expect(
      page.getByRole("heading", { name: "Link de redefinição" })
    ).toBeVisible({ timeout: 10000 });
  });
});
