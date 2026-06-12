import { beforeEach, describe, expect, test } from "vitest";
import {
  bearer,
  clearToken,
  getToken,
  setToken,
  TOKEN_KEY,
} from "./auth-token.js";

// jsdom provides localStorage; reset it between tests.
beforeEach(() => {
  localStorage.clear();
});

describe("bearer", () => {
  test("prefixes a present token", () => {
    expect(bearer("abc")).toBe("Bearer abc");
  });

  test("returns undefined for empty/missing tokens", () => {
    expect(bearer("")).toBeUndefined();
    expect(bearer(null)).toBeUndefined();
    expect(bearer(undefined)).toBeUndefined();
  });
});

describe("token storage", () => {
  test("storage key is stable", () => {
    expect(TOKEN_KEY).toBe("token");
  });

  test("setToken stores a valid token string", () => {
    setToken("my-jwt");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("my-jwt");
  });

  test("setToken(undefined) removes the key — no literal 'undefined' string", () => {
    localStorage.setItem(TOKEN_KEY, "stale");
    setToken(undefined);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test("setToken(null) removes the key — no literal 'null' string", () => {
    localStorage.setItem(TOKEN_KEY, "stale");
    setToken(null);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test("getToken returns null when storage is empty", () => {
    clearToken();
    expect(getToken()).toBeNull();
  });
});
