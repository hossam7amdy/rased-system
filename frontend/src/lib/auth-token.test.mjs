import assert from "node:assert/strict";
import { test } from "node:test";
import { bearer, TOKEN_KEY } from "./auth-token.js";

test("bearer prefixes a present token", () => {
	assert.equal(bearer("abc"), "Bearer abc");
});

test("bearer returns undefined for empty/missing tokens", () => {
	assert.equal(bearer(""), undefined);
	assert.equal(bearer(null), undefined);
	assert.equal(bearer(undefined), undefined);
});

test("token storage key is stable", () => {
	assert.equal(TOKEN_KEY, "token");
});
