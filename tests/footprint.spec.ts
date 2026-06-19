/**
 * Footprint Matcher Unit Tests
 *
 * Tests the campaign-footprint matching layer (N-of-M threshold bands +
 * pivot/splash detection) in src/lib/footprint.ts. This layer is distinct
 * from the per-submission weighted scorer in scoring.ts:
 *   - scoring.ts answers "how bad is this submission?" (0-100)
 *   - footprint.ts answers "which known campaign, and is it a pivot?"
 *
 * Pure computation — NO worker, NO database, NO bypass.
 *
 * Run:
 *   npx playwright test tests/footprint.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
	matchFootprint,
	matchAll,
	detectSplash,
	suggestFootprintUpdate,
	applyFootprintUpdate,
	type Footprint,
	type Indicator,
} from '../src/lib/footprint';

// A 5-indicator cryptomining campaign footprint (cf. the Heroku Monero case:
// Tor exit at signup + free email provider + face-rolled email pattern +
// identical app + CPU pegging). pivotFloor defaults to ceil(5*0.6)=3.
const miner: Footprint = {
	id: 'monero-tor',
	label: 'Monero miner over Tor',
	indicators: [
		{ key: 'signup_ip_type', value: 'tor_exit' },
		{ key: 'email_provider', value: 'throwaway.example' },
		{ key: 'email_pattern', value: 'facerolled' },
		{ key: 'app_hash', value: 'identical-kit-v1' },
		{ key: 'cpu', value: 'pegged' },
	],
};

const phishing: Footprint = {
	id: 'insurance-phish',
	label: 'Insurance phishing kit',
	indicators: [
		{ key: 'email_provider', value: 'throwaway.example' }, // shared TTP with miner
		{ key: 'app_dir', value: 'antibots' },
		{ key: 'collects', value: 'cc_cvv' },
	],
};

// ========== FULL MATCH (N = M) → auto-action ==========

test('5/5 indicators present → full band, auto-action', () => {
	const observed: Indicator[] = [
		{ key: 'signup_ip_type', value: 'tor_exit' },
		{ key: 'email_provider', value: 'throwaway.example' },
		{ key: 'email_pattern', value: 'facerolled' },
		{ key: 'app_hash', value: 'identical-kit-v1' },
		{ key: 'cpu', value: 'pegged' },
	];
	const r = matchFootprint(observed, miner);
	expect(r.matchedCount).toBe(5);
	expect(r.total).toBe(5);
	expect(r.ratio).toBe(1);
	expect(r.band).toBe('full');
	expect(r.action).toBe('auto-action');
	expect(r.missing).toHaveLength(0);
});

// ========== PIVOT (floor ≤ N < M) → review + learn ==========

test('3/5 indicators (actor changed app + cpu) → pivot band, review', () => {
	const observed: Indicator[] = [
		{ key: 'signup_ip_type', value: 'tor_exit' },
		{ key: 'email_provider', value: 'throwaway.example' },
		{ key: 'email_pattern', value: 'facerolled' },
		// app_hash + cpu changed:
		{ key: 'app_hash', value: 'gpg-packed-kit-v2' },
		{ key: 'gpu_probe', value: true },
	];
	const r = matchFootprint(observed, miner);
	expect(r.matchedCount).toBe(3);
	expect(r.band).toBe('pivot');
	expect(r.action).toBe('review');
	// What they dropped/changed:
	expect(r.missing.map((m) => m.key).sort()).toEqual(['app_hash', 'cpu']);
	// Novel indicators are the pivot candidates to learn:
	expect(suggestFootprintUpdate(r).map((n) => n.key).sort()).toEqual(['app_hash', 'gpu_probe']);
});

test('applyFootprintUpdate folds novel indicators in, dedup', () => {
	const r = matchFootprint(
		[
			{ key: 'signup_ip_type', value: 'tor_exit' },
			{ key: 'email_provider', value: 'throwaway.example' },
			{ key: 'email_pattern', value: 'facerolled' },
			{ key: 'gpu_probe', value: true },
		],
		miner,
	);
	const updated = applyFootprintUpdate(miner, suggestFootprintUpdate(r));
	expect(updated.indicators).toContainEqual({ key: 'gpu_probe', value: true });
	// idempotent
	const again = applyFootprintUpdate(updated, suggestFootprintUpdate(r));
	expect(again.indicators.length).toBe(updated.indicators.length);
});

// ========== NONE (N < floor) → ignore ==========

test('2/5 indicators → below pivot floor → none/ignore', () => {
	const r = matchFootprint(
		[
			{ key: 'signup_ip_type', value: 'tor_exit' },
			{ key: 'email_provider', value: 'throwaway.example' },
		],
		miner,
	);
	expect(r.matchedCount).toBe(2);
	expect(r.band).toBe('none');
	expect(r.action).toBe('ignore');
});

// ========== WILDCARD (key-only) matching ==========

test('key-only footprint indicator matches any value for that key', () => {
	const fp: Footprint = {
		id: 'wild',
		label: 'wildcard',
		indicators: [{ key: 'signup_ip_type' }, { key: 'email_provider', value: 'throwaway.example' }],
		pivotFloor: 2,
	};
	const r = matchFootprint(
		[
			{ key: 'signup_ip_type', value: 'datacenter_asn' }, // any value satisfies key-only
			{ key: 'email_provider', value: 'throwaway.example' },
		],
		fp,
	);
	expect(r.matchedCount).toBe(2);
	expect(r.band).toBe('full');
});

// ========== matchAll ordering + filtering ==========

test('matchAll returns strongest first and drops none-band footprints', () => {
	const observed: Indicator[] = [
		{ key: 'email_provider', value: 'throwaway.example' },
		{ key: 'app_dir', value: 'antibots' },
		{ key: 'collects', value: 'cc_cvv' },
		{ key: 'signup_ip_type', value: 'tor_exit' },
	];
	const results = matchAll(observed, [miner, phishing]);
	// phishing is 3/3 (full); miner is 2/5 (none, dropped).
	expect(results).toHaveLength(1);
	expect(results[0].footprintId).toBe('insurance-phish');
	expect(results[0].band).toBe('full');
});

// ========== SPLASH (multiple actors sharing TTPs) ==========

test('detectSplash flags ≥2 distinct footprints matching one observation', () => {
	// Observation hits miner at 3/5 (pivot) AND phishing at 3/3 (full) via the
	// shared throwaway-email TTP → splash (multiple actors, same kit lineage).
	const observed: Indicator[] = [
		{ key: 'signup_ip_type', value: 'tor_exit' },
		{ key: 'email_provider', value: 'throwaway.example' },
		{ key: 'email_pattern', value: 'facerolled' },
		{ key: 'app_dir', value: 'antibots' },
		{ key: 'collects', value: 'cc_cvv' },
	];
	const results = matchAll(observed, [miner, phishing]);
	const splash = detectSplash(results);
	expect(splash).not.toBeNull();
	expect(new Set(splash!.map((r) => r.footprintId)).size).toBe(2);
});

test('detectSplash returns null for a single matching footprint', () => {
	const results = matchAll([{ key: 'app_dir', value: 'antibots' }, { key: 'collects', value: 'cc_cvv' }, { key: 'email_provider', value: 'throwaway.example' }], [
		miner,
		phishing,
	]);
	expect(detectSplash(results)).toBeNull();
});
