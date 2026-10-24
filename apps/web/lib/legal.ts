export const LEGAL_VERSION = "2026-10-19-draft-1";
export const LEGAL_UPDATED = "19 October 2026";
export interface RegistrationLegalStatus { terms_version: string; privacy_version: string; guardian_enabled: boolean; support_email: string | null }

export function registrationLegalError(accepted: boolean, status: RegistrationLegalStatus | null): string | null {
  if (!status || status.terms_version !== LEGAL_VERSION || status.privacy_version !== LEGAL_VERSION) {
    return "Registration is temporarily unavailable while we update our policies. Please try again later.";
  }
  if (!accepted) return "Please read and accept the Terms of Use before continuing.";
  return null;
}

export function registrationLegalMetadata() {
  return {
    terms_accepted: true,
    terms_version: LEGAL_VERSION,
    privacy_version: LEGAL_VERSION,
    age_declaration: "adult" as const,
  };
}
