/**
 * Minimal client helper for posting submissions to a Forminator backend.
 * Can be copied into any frontend or used as-is if this repo is part of your workspace.
 */

export interface ForminatorSubmissionPayload {
	firstName: string;
	lastName: string;
	email: string;
	phone?: string | null;
	address?: {
		street?: string | null;
		city?: string | null;
		state?: string | null;
		postalCode?: string | null;
		country?: string | null;
	} | null;
	dateOfBirth?: string | null;
	turnstileToken: string;
	[key: string]: unknown;
}

export interface ForminatorSubmissionResponse {
	success: boolean;
	submissionId?: number;
	erfid: string;
	message?: string;
	validation?: {
		valid: boolean;
		errors?: string[];
	};
}

export class ForminatorRequestError extends Error {
	constructor(
		message: string,
		public status: number,
		public body?: any
	) {
		super(message);
		this.name = 'ForminatorRequestError';
	}

	get retryAfter(): number | undefined {
		return this.body?.retryAfter;
	}

	get expiresAt(): string | undefined {
		return this.body?.expiresAt;
	}

	get erfid(): string | undefined {
		return this.body?.erfid;
	}
}

export interface SubmitOptions {
	endpoint: string;
	payload: ForminatorSubmissionPayload;
	headers?: Record<string, string>;
	fetchImpl?: typeof fetch;
}

export async function submitToForminator({
	endpoint,
	payload,
	headers,
	fetchImpl,
}: SubmitOptions): Promise<ForminatorSubmissionResponse> {
	const fetcher = fetchImpl ?? fetch;
	const response = await fetcher(endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(headers || {}),
		},
		body: JSON.stringify(payload),
	});

	const body: any = await response.json().catch(() => ({}));

	if (!response.ok) {
		throw new ForminatorRequestError(
			body?.message || `Forminator request failed (HTTP ${response.status})`,
			response.status,
			body
		);
	}

	return body as ForminatorSubmissionResponse;
}
