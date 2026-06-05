import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, unwrap } from "./response.js";

test("unwrap returns the data field of a standard envelope", () => {
	assert.deepEqual(unwrap({ success: true, data: { users: [1] } }), {
		users: [1],
	});
});

test("unwrap returns the sibling payload when no data field", () => {
	assert.deepEqual(unwrap({ success: true, courses: [1, 2] }), {
		courses: [1, 2],
	});
});

test("unwrap throws ApiError carrying message and status on success:false", () => {
	assert.throws(
		() => unwrap({ success: false, message: "nope" }, 400),
		(err) =>
			err instanceof ApiError && err.message === "nope" && err.status === 400,
	);
});

test("unwrap passes through a non-enveloped body unchanged", () => {
	assert.deepEqual(unwrap([1, 2, 3]), [1, 2, 3]);
});
