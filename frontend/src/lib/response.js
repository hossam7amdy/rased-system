// Pure helpers for normalizing the backend response envelope.
// Backend wraps payloads as { success, data, message } but inconsistently:
// some endpoints nest under `data`, others put the payload as a sibling
// (e.g. { success, courses }). Centralizing the unwrap here kills the
// scattered `res.data.data.x` vs `res.data.x` divergence. Phase 1's
// lib/api.ts response interceptor builds on this.

export class ApiError extends Error {
	constructor(message, status) {
		super(message || "Request failed");
		this.name = "ApiError";
		this.status = status;
	}
}

/**
 * Normalize an envelope body into its payload.
 * @param {unknown} body - the axios response body (response.data)
 * @param {number} [status] - HTTP status, attached to thrown ApiError
 * @returns {unknown} the unwrapped payload
 * @throws {ApiError} when the envelope reports success: false
 */
export function unwrap(body, status) {
	if (body && typeof body === "object" && "success" in body) {
		if (body.success === false) {
			throw new ApiError(body.message, status);
		}
		if ("data" in body && body.data !== undefined) {
			return body.data;
		}
		// Envelope with the payload as a sibling of success/message.
		const { success, message, ...rest } = body;
		return rest;
	}
	return body;
}
