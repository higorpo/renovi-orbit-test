import { useSignupForm, SIGNUP_STEPS } from "./useSignupForm";

export const STEPS = SIGNUP_STEPS;

const CLIENT_ONBOARDING_PATH = "/onboarding/client";

export function getClientEmailRedirectTo(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${CLIENT_ONBOARDING_PATH}`;
}

export function useClientSignupForm() {
  return useSignupForm({
    role: "client",
    onboardingPath: CLIENT_ONBOARDING_PATH,
    recaptchaAction: "client_signup_submit",
  });
}
