export type RecoveryAction = "cookies" | "dependencies" | "directory"

export function recoveryAction(errorKey: string | null): RecoveryAction | null {
  if (["error.ageRestricted", "error.cookieAccess", "error.siteBlocked", "error.botCheck"].includes(errorKey ?? "")) return "cookies"
  if (["error.ytdlpNotFound", "error.impersonateUnavailable", "error.invalidOptions", "error.ffmpegNotFound"].includes(errorKey ?? "")) return "dependencies"
  if (errorKey === "error.downloadPathUnavailable") return "directory"
  return null
}

export function estimatedTime(eta: string | null | undefined): string | null {
  const value = eta?.trim()
  return value && /^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(value) ? value : null
}

export function failureSummary(errorKey: string | null, translate: (key: string) => string): string {
  if (errorKey?.startsWith("error.")) {
    const summary = translate(errorKey)
    if (summary !== errorKey) return summary
  }
  return translate("error.downloadFailed")
}
