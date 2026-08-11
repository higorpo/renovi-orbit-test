/**
 * Ensures E2E users exist in Supabase Auth + public.profiles with correct roles.
 * Uses the service role key (server-side only). Run via global-setup or: yarn e2e:seed-my-account
 */
import { createClient } from "@supabase/supabase-js";
import { applyE2eEnv } from "../load-e2e-env.mjs";

applyE2eEnv();

const DEFAULT_CLIENT_EMAIL =
  process.env.E2E_MY_ACCOUNT_CLIENT_EMAIL ?? "e2e.myaccount.client@prestway.test";
const DEFAULT_PROVIDER_EMAIL =
  process.env.E2E_MY_ACCOUNT_PROVIDER_EMAIL ?? "e2e.myaccount.provider@prestway.test";
const DEFAULT_PASSWORD =
  process.env.E2E_MY_ACCOUNT_PASSWORD ?? "E2E_SecurePass123!";

function getServiceRoleKey() {
  return (
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  );
}

async function findUserByEmail(adminAuth, email) {
  const normalized = email.toLowerCase();
  let page = 1;
  const maxPages = 30;
  while (page <= maxPages) {
    const { data, error } = await adminAuth.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (found) return found;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

/**
 * @param {{ url: string, serviceRole: string }} opts
 */
export async function seedMyAccountE2eUsers(opts) {
  const { url, serviceRole } = opts;
  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const specs = [
    {
      email: DEFAULT_CLIENT_EMAIL,
      password: DEFAULT_PASSWORD,
      user_metadata: {
        full_name: "E2E Cliente Conta",
        role: "client",
      },
      profile: { full_name: "E2E Cliente Conta", role: "client" },
    },
    {
      email: DEFAULT_PROVIDER_EMAIL,
      password: DEFAULT_PASSWORD,
      user_metadata: {
        full_name: "E2E Prestador Conta",
        role: "provider",
      },
      profile: { full_name: "E2E Prestador Conta", role: "provider" },
    },
  ];

  for (const spec of specs) {
    let userId;
    const existing = await findUserByEmail(admin.auth.admin, spec.email);
    if (existing) {
      userId = existing.id;
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password: spec.password,
        email_confirm: true,
        user_metadata: { ...existing.user_metadata, ...spec.user_metadata },
      });
      if (updErr) throw updErr;
    } else {
      const { data, error: createErr } = await admin.auth.admin.createUser({
        email: spec.email,
        password: spec.password,
        email_confirm: true,
        user_metadata: spec.user_metadata,
      });
      if (createErr) throw createErr;
      userId = data.user.id;
    }

    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        full_name: spec.profile.full_name,
        role: spec.profile.role,
      })
      .eq("id", userId);

    if (profileErr) {
      console.warn(
        `[e2e seed] profiles update for ${spec.email}:`,
        profileErr.message
      );
    }
  }

  await seedMyAccountE2eFixtures(admin, DEFAULT_CLIENT_EMAIL, DEFAULT_PROVIDER_EMAIL);

  console.log(
    `[e2e seed] My Account users ready: client=${DEFAULT_CLIENT_EMAIL} provider=${DEFAULT_PROVIDER_EMAIL}`
  );
}

const E2E_CLIENT_ADDRESS_LABEL = "E2E Seed";
const E2E_PLATFORM_SERVICE_SLUG = "e2e-my-account-fixture-service";

/**
 * Idempotent data for My Account real E2E: one client address, empty provider offers,
 * at least one active platform_services row whose title matches search "a".
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} clientEmail
 * @param {string} providerEmail
 */
async function seedMyAccountE2eFixtures(admin, clientEmail, providerEmail) {
  const clientUser = await findUserByEmail(admin.auth.admin, clientEmail);
  const providerUser = await findUserByEmail(admin.auth.admin, providerEmail);
  if (!clientUser || !providerUser) {
    console.warn("[e2e seed] fixtures skipped: client or provider user missing");
    return;
  }

  const { data: svcMatch } = await admin
    .from("platform_services")
    .select("id")
    .eq("active", true)
    .ilike("title", "%a%")
    .limit(1)
    .maybeSingle();

  if (!svcMatch) {
    const { data: bySlug } = await admin
      .from("platform_services")
      .select("id")
      .eq("slug", E2E_PLATFORM_SERVICE_SLUG)
      .maybeSingle();
    if (!bySlug) {
      const { error: insErr } = await admin.from("platform_services").insert({
        title: "Ar condicionado E2E",
        slug: E2E_PLATFORM_SERVICE_SLUG,
        active: true,
        show_on_request_quote: true,
        sort_order: 99999,
      });
      if (insErr) {
        console.warn("[e2e seed] fixtures platform_services insert:", insErr.message);
      } else {
        console.log("[e2e seed] fixtures: inserted E2E platform service for search");
      }
    }
  }

  const { error: delOffersErr } = await admin
    .from("provider_offered_services")
    .delete()
    .eq("provider_id", providerUser.id);
  if (delOffersErr) {
    console.warn("[e2e seed] fixtures provider_offered_services delete:", delOffersErr.message);
  }

  const { data: city, error: cityErr } = await admin
    .from("platform_cities")
    .select("id, state_id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (cityErr || !city) {
    console.warn(
      "[e2e seed] fixtures: no active platform_cities — address seed skipped:",
      cityErr?.message ?? "empty"
    );
    return;
  }

  await admin
    .from("client_addresses")
    .delete()
    .eq("client_id", clientUser.id)
    .eq("label", E2E_CLIENT_ADDRESS_LABEL);

  const { error: addrErr } = await admin.from("client_addresses").insert({
    client_id: clientUser.id,
    label: E2E_CLIENT_ADDRESS_LABEL,
    street: "Rua E2E",
    number: "100",
    neighborhood: "Centro",
    zip_code: "01310100",
    state_id: city.state_id,
    city_id: city.id,
    is_default: true,
    is_active: true,
  });

  if (addrErr) {
    console.warn("[e2e seed] fixtures client_addresses insert:", addrErr.message);
  } else {
    console.log("[e2e seed] fixtures: seeded client address for My Account E2E");
  }
}

/**
 * Deletes the two fixed My Account E2E users by email (Auth API). FK cascade removes profile rows.
 * @param {{ url: string, serviceRole: string }} opts
 */
export async function deleteMyAccountE2eUsers(opts) {
  const { url, serviceRole } = opts;
  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const emails = [DEFAULT_CLIENT_EMAIL, DEFAULT_PROVIDER_EMAIL];

  for (const email of emails) {
    const user = await findUserByEmail(admin.auth.admin, email);
    if (!user) {
      console.log(`[e2e teardown] No user to delete: ${email}`);
      continue;
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.warn(`[e2e teardown] Failed to delete ${email}:`, error.message);
    } else {
      console.log(`[e2e teardown] Deleted user ${email}`);
    }
  }
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL ?? "";
  const serviceRole = getServiceRoleKey();
  if (!url || !serviceRole) {
    console.error(
      "[e2e seed] Missing VITE_SUPABASE_URL or E2E_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }
  await seedMyAccountE2eUsers({ url, serviceRole });
}

if (process.argv[1]?.includes("seed-my-account-e2e-users.mjs")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
