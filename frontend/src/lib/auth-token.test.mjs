import assert from "node:assert/strict";
import { test } from "node:test";
import {
	bearer,
	clearToken,
	getToken,
	setToken,
	TOKEN_KEY,
} from "./auth-token.js";

// Minimal localStorage stub for Node.js (mirrors browser coercion behaviour)
const _store = {};
global.localStorage = {
	getItem: (k) => (Object.hasOwn(_store, k) ? _store[k] : null),
	setItem: (k, v) => {
		_store[k] = String(v);
	},
	removeItem: (k) => {
		delete _store[k];
	},
	clear: () => {
		for (const k of Object.keys(_store)) delete _store[k];
	},
};

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

test("setToken stores a valid token string", () => {
	setToken("my-jwt");
	assert.equal(localStorage.getItem(TOKEN_KEY), "my-jwt");
	clearToken();
});

test("setToken(undefined) removes the key — no literal 'undefined' string", () => {
	localStorage.setItem(TOKEN_KEY, "stale");
	setToken(undefined);
	assert.equal(localStorage.getItem(TOKEN_KEY), null);
});

test("setToken(null) removes the key — no literal 'null' string", () => {
	localStorage.setItem(TOKEN_KEY, "stale");
	setToken(null);
	assert.equal(localStorage.getItem(TOKEN_KEY), null);
});

test("getToken returns null when storage is empty", () => {
	clearToken();
	assert.equal(getToken(), null);
});
