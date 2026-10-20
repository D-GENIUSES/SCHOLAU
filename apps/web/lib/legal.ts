export const LEGAL_VERSION = "2026-10-19-draft-1";
export const LEGAL_UPDATED = "19 October 2026";
export type AgeDeclaration = "" | "adult" | "under18";
export interface RegistrationLegalStatus { terms_version: string; privacy_version: string; guardian_enabled: boolean; support_email: string | null }
export function registrationLegalError(age: AgeDeclaration, accepted: boolean, approval: string, status: RegistrationLegalStatus | null): string | null {
  if (!status || status.terms_version !== LEGAL_VERSION || status.privacy_version !== LEGAL_VERSION) return "Registration is temporarily unavailable while we update our policies. Please try again later.";
  if (!age) return "Select your age group before continuing.";
  if (age === "under18" && !status.guardian_enabled) return "Registration for students under 18 is not open yet. Guardian verification and support contacts must be ready first. No account has been created.";
  if (age === "under18" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(approval.trim())) return "Enter the approval code supplied after support verifies your parent or guardian’s consent.";
  if (!accepted) return "Please read and accept the Terms of Use before continuing.";
  return null;
}
export function registrationLegalMetadata(age: AgeDeclaration, approval: string) {
  return { terms_accepted: true, terms_version: LEGAL_VERSION, privacy_version: LEGAL_VERSION, age_declaration: age, ...(age === "under18" ? { guardian_approval: approval.trim() } : {}) };
}
