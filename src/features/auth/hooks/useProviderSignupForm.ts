import { useSignupForm, SIGNUP_STEPS } from "./useSignupForm";

export const STEPS = SIGNUP_STEPS;

const PROVIDER_ONBOARDING_PATH = "/onboarding/provider";

export function useProviderSignupForm() {
  return useSignupForm({
    role: "provider",
    onboardingPath: PROVIDER_ONBOARDING_PATH,
    recaptchaAction: "provider_signup_submit",
  });
}
