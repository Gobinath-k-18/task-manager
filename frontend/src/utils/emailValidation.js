export function isValidEmail(email) {
  return /^[^\s@]+@gmail\.com$/i.test(email)
}
