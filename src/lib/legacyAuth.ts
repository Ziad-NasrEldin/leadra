const legacyPasswordMinLength = 10
const legacyPasswordPadding = '00'

export function authPasswordForAdminUpdate(password: string): string {
  if (password.length >= legacyPasswordMinLength) return password
  return `${password}${legacyPasswordPadding.slice(0, legacyPasswordMinLength - password.length)}`
}

export function authPasswordCandidates(password: string): string[] {
  const compatiblePassword = authPasswordForAdminUpdate(password)
  return compatiblePassword === password ? [password] : [password, compatiblePassword]
}
