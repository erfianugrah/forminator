import { useState, useEffect, useRef } from 'react';

export interface BlacklistEntry {
	id: number;
	ephemeral_id: string | null;
	ip_address: string | null;
	ja4: string | null;
	country: string | null;
	city: string | null;
	detection_type?: string | null;
	detection_confidence?: 'high' | 'medium' | 'low' | null;
	block_reason: string;
	risk_score: number;
	risk_score_breakdown?: string | null;
	ja4_signals?: string | null;
	offense_count: number;
	blocked_at: string;
	expires_at: string;
	erfid: string | null;
	submission_count?: number | null;
	last_seen_at?: string | null;
	detection_metadata?: string | null;
}

export interface UseBlacklistReturn {
	entries: BlacklistEntry[];
	loading: boolean;
	error: string | null;
	refresh: () => void;
}

export function useBlacklist(apiKey: string): UseBlacklistReturn {
	const [entries, setEntries] = useState<BlacklistEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	const loadData = async (signal?: AbortSignal) => {
		if (!apiKey) return;

		setLoading(true);
		setError(null);

		const headers: HeadersInit = { 'X-API-KEY': apiKey };

		try {
			const res = await fetch('/api/analytics/blacklist', { headers, signal });

			if (!res.ok) {
				throw new Error('Failed to fetch blacklist entries');
			}

			const data = await res.json();
			setEntries((data as any).data || []);
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			console.error('Error loading blacklist entries:', err);
			setError('Failed to load blacklist entries');
			setEntries([]);
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
	}, [apiKey]);

	return {
		entries,
		loading,
		error,
		refresh: () => loadData(),
	};
}
