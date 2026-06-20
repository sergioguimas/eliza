export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function validatePassword(password: string) {
  if (password.length < 8) {
    return "A senha deve ter pelo menos 8 caracteres."
  }

  if (!/[A-Za-z]/.test(password)) {
    return "A senha deve conter pelo menos uma letra."
  }

  if (!/[0-9]/.test(password)) {
    return "A senha deve conter pelo menos um número."
  }

  return null
}