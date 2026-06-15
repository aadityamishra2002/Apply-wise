export const APPLIED_CONFIRMATION_TEXT = "Mark this role as applied only after you manually clicked submit on the employer site. Apply Wise does not submit applications automatically. Continue?";

export type ApplicationStatusUpdateDecision = {
  proceed: boolean;
  manualSubmissionConfirmed: boolean;
};

export type ApplicationStatusPayload = {
  status: string;
  manual_submission_confirmed: boolean;
};

export type ApplicationStatusRecord = {
  id: string;
  status: string;
};

export function resolveStatusUpdateDecision(
  status: string,
  confirmedManualSubmit: boolean,
  confirmManualSubmit: () => boolean,
): ApplicationStatusUpdateDecision {
  if (status !== "applied") return { proceed: true, manualSubmissionConfirmed: false };
  if (confirmedManualSubmit) return { proceed: true, manualSubmissionConfirmed: true };
  const accepted = confirmManualSubmit();
  return { proceed: accepted, manualSubmissionConfirmed: accepted };
}

export function buildApplicationStatusPayload(status: string, manualSubmissionConfirmed: boolean): ApplicationStatusPayload {
  return {
    status,
    manual_submission_confirmed: status === "applied" && manualSubmissionConfirmed,
  };
}

export function replaceApplicationRecord<TApplication extends ApplicationStatusRecord>(
  applications: TApplication[],
  updated: TApplication,
): TApplication[] {
  return applications.map((application) => (application.id === updated.id ? updated : application));
}

export function applicationStatusSuccessMessage(status: string): string {
  if (status === "applied") return "Application marked Applied after manual submission.";
  return `Application status updated to ${status}.`;
}
