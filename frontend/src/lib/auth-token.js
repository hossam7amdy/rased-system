// Single source of truth for the auth token: storage key, read/write/clear,
// and the Authorization header value. Replaces the scattered
// `localStorage.getItem("token")` reads and the 3 hand-built
// `Bearer ${...}` strings across the app.

export const TOKEN_KEY = "token";

/** @returns {string | null} */
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** @param {string | null | undefined} token */
export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Build an Authorization header value, or undefined when there is no token.
 * @param {string | null | undefined} token
 * @returns {string | undefined}
 */
export function bearer(token) {
  return token ? `Bearer ${token}` : undefined;
}
