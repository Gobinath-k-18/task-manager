const TOKEN_KEY = 'taskManagerToken'
const USER_KEY = 'taskManagerUser'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  try {
    const storedUser = localStorage.getItem(USER_KEY)
    return storedUser ? JSON.parse(storedUser) : null
  } catch {
    return null
  }
}

export function saveAuth(token, user) {
  const safeUser = {
    id: user?.id,
    name: user?.name,
    email: user?.email,
  }

  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(safeUser))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}