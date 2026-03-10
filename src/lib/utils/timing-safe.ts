/**
 * Constant-time string comparison for API key validation.
 *
 * Unlike the naive approach of checking `byteLength` before `timingSafeEqual`,
 * this function pads both inputs to the same length so the comparison time
 * does not leak the expected key's length.
 *
 * @param a - The user-provided value (may be empty)
 * @param b - The expected/secret value (may be empty)
 * @returns true if both strings are non-empty and equal
 */
export function timingSafeCompare(a: string, b: string): boolean {
	if (a.length === 0 || b.length === 0) return false;

	const encoder = new TextEncoder();
	const aBytes = encoder.encode(a);
	const bBytes = encoder.encode(b);

	// Use the longer length so timing doesn't reveal key size
	const maxLen = Math.max(aBytes.byteLength, bBytes.byteLength);

	// Pad both to maxLen (extra bytes are 0, and they'll match each other
	// but the length mismatch flag below will ensure false result)
	const aPadded = new Uint8Array(maxLen);
	const bPadded = new Uint8Array(maxLen);
	aPadded.set(aBytes);
	bPadded.set(bBytes);

	// timingSafeEqual requires same-length buffers — we've ensured that above
	const bytesEqual = (crypto.subtle as unknown as { timingSafeEqual(a: BufferSource, b: BufferSource): boolean }).timingSafeEqual(
		aPadded,
		bPadded,
	);

	// Both content and length must match
	return bytesEqual && aBytes.byteLength === bBytes.byteLength;
}
