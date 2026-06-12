import { describe, expect, test } from "vitest";
import { ApiError, unwrap } from "./response.js";

describe("unwrap", () => {
  test("returns the data field of a standard envelope", () => {
    expect(unwrap({ success: true, data: { users: [1] } })).toEqual({
      users: [1],
    });
  });

  test("returns the sibling payload when no data field", () => {
    expect(unwrap({ success: true, courses: [1, 2] })).toEqual({
      courses: [1, 2],
    });
  });

  test("throws ApiError carrying message and status on success:false", () => {
    let err: unknown;
    try {
      unwrap({ success: false, message: "nope" }, 400);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe("nope");
    expect((err as ApiError).status).toBe(400);
  });

  test("passes through a non-enveloped body unchanged", () => {
    expect(unwrap([1, 2, 3])).toEqual([1, 2, 3]);
  });
});
