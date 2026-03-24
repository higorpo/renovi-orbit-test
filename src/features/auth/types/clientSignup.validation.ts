// Re-export shared signup schema; alias type for backward compat.
export {
  signUpSchema,
  validateFullName,
  zodIssuesToFieldErrors,
} from "./signup.validation";
export type { SignupFormData as ClientSignupFormData } from "./signup.validation";
