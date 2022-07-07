import { AuthLevels } from '$lib/auth-levels'
import { User } from '$stores/user'

/** localStorage keys */
export const enum Keys {
  CSRF = 'CSRF-Token',
  User = 'user',
  AuthLevel = 'authlevel'
}

/** Static getters and setters for localStorage */
export const storage = {
  getCSRFtoken(): string {
    return localStorage.getItem(Keys.CSRF)!
  },
  setCSRFtoken(token: string): void {
    localStorage.setItem(Keys.CSRF, token)
  },

  getUser(): User {
    return JSON.parse(localStorage.getItem(Keys.User)!)
  },
  setUser(user: User): void {
    localStorage.setItem(Keys.User, JSON.stringify(user))
  },

  getAuthLevel(): AuthLevels {
    return parseInt(localStorage.getItem(Keys.AuthLevel)!)
  },
  setAuthLevel(authLevel: AuthLevels): void {
    localStorage.setItem(Keys.AuthLevel, authLevel.toString())
  }
}

export default storage