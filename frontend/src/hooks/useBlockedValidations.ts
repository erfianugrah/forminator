import { useState, useEffect, useRef } from 'react';

export type DetectionType =
	| 'email_fraud_detection'
	| 'ephemeral_id_tracking'
	| 'ja4_fingerprinting'
	| 'token_replay_protection'
	| 'turnstile_validation'
	| 'pre_validation_blacklist'
	| 'duplicate_email'
	| 'holistic_risk'
	| 'header_fingerprint_reuse'
	| 'tls_fingerprint_anomaly'
	| 'latency_mismatch'
	| 'fingerprint_anomaly'
	| 'other';

export interface BlockedValidation {
	id: number;
	ephemeral_id: string | null;
	ip_address: string;
	country: string | null;
	city: string | null;
	block_reason: string;
	risk_score: number;
	challenge_ts: string;
	ja4: string | null;
	risk_score_breakdown?: string | null;
	detection_type: DetectionType | null;
	bot_score?: number | null;
	user_agent?: string | null;
	erfid?: string | null;
	source?: 'validation' | 'fraud_block';
	fraud_signals_json?: string | null;
}

export interface UseBlockedValidationsReturn {
	validations: BlockedValidation[];
	loading: boolean;
	error: string | null;
	refresh: () => void;
}

export function useBlockedValidations(apiKey: string, limit = 100): UseBlockedValidationsReturn {
	const [validations, setValidations] = useState<BlockedValidation[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	const loadData = async (signal?: AbortSignal) => {
		if (!apiKey) return;

		setLoading(true);
		setError(null);

		const headers: HeadersInit = { 'X-API-KEY': apiKey };

		try {
			const res = await fetch(`/api/analytics/blocked-validations?limit=${limit}`, { headers, signal });

			if (!res.ok) {
				throw new Error('Failed to fetch blocked validations');
			}

			const data = await res.json();
			setValidations((data as any).data || []);
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			console.error('Error loading blocked validations:', err);
			setError('Failed to load blocked validations');
			setValidations([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		abortControllerRef.current?.abort();
		const controller = new AbortController();
		abortControllerRef.current = controller;
		loadData(controller.signal);
		return () => controller.abort();
	}, [apiKey, limit]);

	return {
		validations,
		loading,
		error,
		refresh: () => loadData(),
	};
}
