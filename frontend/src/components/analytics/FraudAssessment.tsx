import { Card, CardHeader, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { AlertTriangle, Calculator, Fingerprint as FingerprintIcon, Info, ArrowRight, Scale, Zap, ShieldAlert } from 'lucide-react';
import type { FraudDetectionConfig } from '../../hooks/useConfig';

interface RiskComponent {
	score: number;
	weight: number;
	contribution: number;
	rawScore?: number;
	reason: string;
}

interface FingerprintDetails {
	headerReuse?: {
		total?: number;
		ipCount?: number;
		ja4Count?: number;
	};
	tlsAnomaly?: {
		ja4Count?: number;
		pairCount?: number;
	};
	latency?: {
		rtt?: number;
		platform?: string;
		deviceType?: string;
		claimedMobile?: boolean;
		suspectAsn?: boolean;
	};
}

interface ScoringDecision {
	weightRedistribution?: {
		inactiveWeight: number;
		normalizationFactor: number;
		reason: string;
	};
	corroborationBonus?: {
		applied: boolean;
		bonus: number;
		corroboratingSignals: string[];
		threshold: number;
		minSignals: number;
	};
	deterministicBlock?: {
		trigger: string;
		qualified: boolean;
		mode: string;
	};
	forceBlock?: {
		trigger: string;
	};
	baseScore: number;
	normalizedScore: number;
	adjustedScore: number;
	finalScore: number;
}

interface RiskBreakdown {
	total: number;
	components: {
		tokenReplay?: RiskComponent;
		emailFraud?: RiskComponent;
		ephemeralId?: RiskComponent;
		validationFrequency?: RiskComponent;
		ipDiversity?: RiskComponent;
		ja4SessionHopping?: RiskComponent;
		ipRateLimit?: RiskComponent;
		headerFingerprint?: RiskComponent;
		tlsAnomaly?: RiskComponent;
		latencyMismatch?: RiskComponent;
	};
	decision?: ScoringDecision;
	fingerprintDetails?: FingerprintDetails;
	fingerprintWarnings?: string[];
}

interface FraudAssessmentProps {
	breakdown: RiskBreakdown;
	config?: FraudDetectionConfig;
}

export function FraudAssessment({ breakdown, config }: FraudAssessmentProps) {
	const { total, components } = breakdown;

	// Use config thresholds or defaults
	const blockThreshold = config?.risk.blockThreshold ?? 70;
	const mediumThreshold = config?.risk.levels.medium.min ?? 40;

	const severity = total >= blockThreshold ? 'destructive' : total >= mediumThreshold ? 'default' : 'secondary';
	const severityColor =
		total >= blockThreshold
			? 'border-red-500 dark:border-red-400'
			: total >= mediumThreshold
				? 'border-yellow-500 dark:border-yellow-400'
				: 'border-green-500 dark:border-green-400';

	const severityText = total >= blockThreshold ? 'HIGH RISK (Blocked)' : total >= mediumThreshold ? 'MEDIUM RISK' : 'LOW RISK';

	return (
		<Card className={`border-l-4 ${severityColor}`}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-lg font-semibold flex items-center gap-2">
							<Calculator className="h-5 w-5" />
							Risk Score Calculation
						</h3>
						<p className="text-xs text-muted-foreground mt-1">
							{severityText} • Threshold: {blockThreshold}/100
						</p>
					</div>
					<Badge variant={severity} className="text-lg font-mono">
						{total}/100
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Overall progress bar */}
				<div>
					<div className="flex justify-between text-sm mb-2">
						<span>Final Risk Score</span>
					</div>
					<Progress value={total} className="h-3" />
				</div>

				{/* Component Breakdown */}
				<div className="space-y-3">
					<h4 className="font-semibold text-sm">Component Breakdown:</h4>
					{renderComponentList(components)}
					{renderFingerprintInsights(breakdown, config)}
				</div>

				{/* Decision Trail — shows how the final score was calculated */}
				{renderDecisionTrail(breakdown, blockThreshold)}

				{/* Final Score */}
				<div className="border-t-2 border-gray-300 dark:border-gray-700 pt-3">
					<div className="flex items-center justify-between font-semibold">
						<span className="text-sm">Final Risk Score:</span>
						<span className="font-mono text-lg">{total}/100</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// ========== DECISION TRAIL ==========

const TRIGGER_LABELS: Record<string, string> = {
	token_replay: 'Token Replay (instant block)',
	turnstile_failed: 'Turnstile Failure (instant block)',
	email_fraud: 'Email Fraud (defensive mode)',
	ephemeral_id_fraud: 'Ephemeral ID Fraud (defensive mode)',
	validation_frequency: 'Validation Frequency (defensive mode)',
	ja4_session_hopping: 'JA4 Session Hopping (defensive mode)',
	duplicate_email: 'Duplicate Email (defensive mode)',
	repeat_offender: 'Repeat Offender (defensive mode)',
	ip_diversity: 'IP Diversity',
	ip_rate_limit: 'IP Rate Limit',
	header_fingerprint: 'Header Fingerprint',
	tls_anomaly: 'TLS Anomaly',
	latency_mismatch: 'Latency Mismatch',
};

/**
 * Reconstruct a decision trail from legacy data that doesn't have a `decision` field.
 * Uses component weights and raw scores to infer weight redistribution and deterministic blocks.
 */
function computeLegacyDecision(breakdown: RiskBreakdown, blockThreshold: number): ScoringDecision {
	const { components, total } = breakdown;
	const comps = Object.entries(components);

	// Step 1: Base weighted sum
	const baseScore = comps.reduce((sum, [, c]) => sum + (c?.contribution ?? 0), 0);

	// Step 2: Detect inactive weights
	const tokenReplayInactive = (components.tokenReplay?.score ?? 0) === 0;
	const ephemeralAtBaseline = components.ephemeralId?.rawScore === undefined || (components.ephemeralId?.rawScore ?? 0) <= 1;
	const validationAtBaseline =
		components.validationFrequency?.rawScore === undefined || (components.validationFrequency?.rawScore ?? 0) <= 1;
	const ipDiversityAtBaseline = components.ipDiversity?.rawScore === undefined || (components.ipDiversity?.rawScore ?? 0) <= 1;

	let inactiveWeight = 0;
	const inactiveReasons: string[] = [];

	if (tokenReplayInactive) {
		inactiveWeight += components.tokenReplay?.weight ?? 0.28;
		inactiveReasons.push(`tokenReplay (${((components.tokenReplay?.weight ?? 0.28) * 100).toFixed(0)}%)`);
	}
	if (ephemeralAtBaseline && validationAtBaseline && ipDiversityAtBaseline) {
		const ew = components.ephemeralId?.weight ?? 0.15;
		const vw = components.validationFrequency?.weight ?? 0.1;
		const iw = components.ipDiversity?.weight ?? 0.07;
		inactiveWeight += ew + vw + iw;
		inactiveReasons.push(
			`ephemeralId+validationFrequency+ipDiversity (${((ew + vw + iw) * 100).toFixed(0)}%) — all at baseline`,
		);
	}

	const normalizationFactor = inactiveWeight < 1.0 ? 1.0 / (1.0 - inactiveWeight) : 1.0;
	const normalizedScore = baseScore * normalizationFactor;

	const decision: ScoringDecision = {
		baseScore: Math.round(baseScore * 100) / 100,
		normalizedScore: Math.round(normalizedScore * 100) / 100,
		adjustedScore: Math.round(normalizedScore * 100) / 100, // No corroboration data in legacy
		finalScore: total,
	};

	if (inactiveWeight > 0) {
		decision.weightRedistribution = {
			inactiveWeight: Math.round(inactiveWeight * 100) / 100,
			normalizationFactor: Math.round(normalizationFactor * 1000) / 1000,
			reason: inactiveReasons.join('; '),
		};
	}

	// Detect if a deterministic/force block was applied (total >= blockThreshold but adjusted score < total)
	if (total >= blockThreshold && normalizedScore < total) {
		// Check for force-block triggers (token replay)
		if ((components.tokenReplay?.score ?? 0) === 100) {
			decision.forceBlock = { trigger: 'token_replay' };
		} else {
			// Infer deterministic block — we can't know the exact trigger from legacy data,
			// but we can detect that the score was floored
			const highestNonTokenComponent = comps
				.filter(([key]) => key !== 'tokenReplay')
				.sort(([, a], [, b]) => (b?.score ?? 0) - (a?.score ?? 0))[0];
			if (highestNonTokenComponent) {
				const triggerKey = highestNonTokenComponent[0];
				// Map camelCase component key to snake_case trigger name
				const triggerMap: Record<string, string> = {
					emailFraud: 'email_fraud',
					ephemeralId: 'ephemeral_id_fraud',
					validationFrequency: 'validation_frequency',
					ja4SessionHopping: 'ja4_session_hopping',
					ipRateLimit: 'ip_rate_limit',
					ipDiversity: 'ip_diversity',
				};
				decision.deterministicBlock = {
					trigger: triggerMap[triggerKey] || triggerKey,
					qualified: true,
					mode: 'defensive',
				};
			}
		}
	}

	return decision;
}

function renderDecisionTrail(breakdown: RiskBreakdown, blockThreshold: number) {
	const d = breakdown.decision || computeLegacyDecision(breakdown, blockThreshold);

	const steps: Array<{ icon: typeof ArrowRight; label: string; value: string; detail?: string; highlight?: boolean }> = [];

	// Step 1: Base weighted sum
	steps.push({
		icon: Calculator,
		label: 'Weighted Sum',
		value: `${d.baseScore.toFixed(1)} pts`,
		detail: 'Sum of all (score × weight) contributions',
	});

	// Step 2: Weight redistribution
	if (d.weightRedistribution) {
		const wr = d.weightRedistribution;
		steps.push({
			icon: Scale,
			label: 'Weight Redistribution',
			value: `× ${wr.normalizationFactor.toFixed(2)} → ${d.normalizedScore.toFixed(1)} pts`,
			detail: `${(wr.inactiveWeight * 100).toFixed(0)}% of weight inactive (${wr.reason}). Remaining signals scaled up so 100 is still reachable.`,
			highlight: true,
		});
	}

	// Step 3: Corroboration bonus
	if (d.corroborationBonus) {
		const cb = d.corroborationBonus;
		if (cb.applied) {
			steps.push({
				icon: Zap,
				label: 'Corroboration Bonus',
				value: `+${cb.bonus} pts → ${d.adjustedScore.toFixed(1)} pts`,
				detail: `${cb.corroboratingSignals.length} signals ≥ ${cb.threshold} fired simultaneously (${cb.corroboratingSignals.map((s) => formatComponentNameShort(s)).join(', ')}). Convergence of evidence adds ${cb.bonus} flat bonus.`,
				highlight: true,
			});
		} else if (cb.corroboratingSignals.length > 0) {
			steps.push({
				icon: Zap,
				label: 'Corroboration Check',
				value: 'Not triggered',
				detail: `${cb.corroboratingSignals.length}/${cb.minSignals} signals ≥ ${cb.threshold} (need ${cb.minSignals}+ for bonus)`,
			});
		}
	}

	// Step 4: Deterministic / force block
	if (d.forceBlock) {
		steps.push({
			icon: ShieldAlert,
			label: 'Force Block',
			value: `Score floored to ${blockThreshold}`,
			detail: `Trigger: ${TRIGGER_LABELS[d.forceBlock.trigger] || d.forceBlock.trigger}. Score raised to at least the block threshold.`,
			highlight: true,
		});
	} else if (d.deterministicBlock) {
		const db = d.deterministicBlock;
		if (db.qualified) {
			steps.push({
				icon: ShieldAlert,
				label: 'Deterministic Block',
				value: `Score floored to ${blockThreshold}`,
				detail: `Trigger: ${TRIGGER_LABELS[db.trigger] || db.trigger} (${db.mode} mode). Signal pattern qualifies for guaranteed block.`,
				highlight: true,
			});
		} else {
			steps.push({
				icon: ShieldAlert,
				label: 'Deterministic Check',
				value: 'Not qualified',
				detail: `Trigger: ${TRIGGER_LABELS[db.trigger] || db.trigger} was present but supporting signals didn't meet qualification criteria.`,
			});
		}
	}

	return (
		<div className="space-y-2 border-t border-border/70 pt-3 mt-3">
			<div className="flex items-center gap-2 text-sm font-semibold">
				<ArrowRight className="h-4 w-4 text-primary" />
				<span>Decision Trail</span>
			</div>
			<div className="space-y-1.5">
				{steps.map((step, idx) => {
					const Icon = step.icon;
					return (
						<div
							key={idx}
							className={`flex items-start gap-2 text-xs p-2 rounded-md ${
								step.highlight
									? 'bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
									: 'bg-muted/30 border border-transparent'
							}`}
						>
							<Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
							<div className="flex-1 min-w-0">
								<div className="flex items-center justify-between gap-2">
									<span className="font-medium">{step.label}</span>
									<span className="font-mono font-semibold flex-shrink-0">{step.value}</span>
								</div>
								{step.detail && <p className="text-muted-foreground mt-0.5">{step.detail}</p>}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function formatComponentNameShort(key: string): string {
	const names: Record<string, string> = {
		tokenReplay: 'Token Replay',
		emailFraud: 'Email',
		ephemeralId: 'Device',
		validationFrequency: 'Validation',
		ipDiversity: 'IP Diversity',
		ja4SessionHopping: 'Session Hop',
		ipRateLimit: 'IP Rate',
		headerFingerprint: 'Header FP',
		tlsAnomaly: 'TLS',
		latencyMismatch: 'Latency',
	};
	return names[key] || key;
}

// ========== COMPONENT CARDS ==========

function ComponentCard({ id, component }: { id: string; component: RiskComponent }) {
	const hasScore = component.score > 0;

	const color = hasScore
		? component.score >= 70
			? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
			: component.score >= 40
				? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950'
				: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950'
		: 'border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50';

	return (
		<div className={`border rounded-lg p-3 ${color} ${!hasScore && 'opacity-60'}`}>
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="font-medium text-sm">{formatComponentName(id, component)}</span>
						{!hasScore && (
							<Badge variant="secondary" className="text-xs">
								Not Triggered
							</Badge>
						)}
					</div>
					<div className="text-xs text-muted-foreground mb-2">{component.reason}</div>

					{/* Calculation formula */}
					<div className="font-mono text-xs bg-white/50 dark:bg-black/20 rounded px-2 py-1 border border-gray-200 dark:border-gray-700">
						<span className={hasScore ? 'font-semibold' : ''}>{component.score}</span>
						{' × '}
						<span>{(component.weight * 100).toFixed(0)}%</span>
						{' = '}
						<span className={hasScore ? 'font-semibold text-base' : ''}>{component.contribution.toFixed(2)} pts</span>
					</div>
				</div>

				<Badge variant={hasScore ? 'default' : 'outline'} className="font-mono flex-shrink-0">
					{component.score}/100
				</Badge>
			</div>
		</div>
	);
}

function getOrderedComponents(components: RiskBreakdown['components']): [string, RiskComponent | undefined][] {
	// Return components in a fixed order for consistency
	const order = [
		'tokenReplay',
		'emailFraud',
		'ephemeralId',
		'validationFrequency',
		'ipDiversity',
		'ja4SessionHopping',
		'ipRateLimit',
		'headerFingerprint',
		'tlsAnomaly',
		'latencyMismatch',
	];

	return order.map((key) => [key, components[key as keyof typeof components]] as [string, RiskComponent | undefined]);
}

function renderComponentList(components: RiskBreakdown['components']) {
	const ordered = getOrderedComponents(components);
	const triggered = ordered.filter(([, comp]) => comp && comp.score > 0);
	const inactive = ordered.filter(([, comp]) => comp && comp.score === 0);

	if (triggered.length === 0) {
		return (
			<div className="text-xs text-muted-foreground bg-muted/20 rounded-md p-3">
				No risk components were triggered for this request. (All scores are 0.)
			</div>
		);
	}

	return (
		<>
			{triggered.map(([key, component]) => (component ? <ComponentCard key={key} id={key} component={component} /> : null))}
			{inactive.length > 0 && (
				<div className="text-xs text-muted-foreground bg-muted/20 rounded-md p-2.5 flex items-center gap-1.5">
					<span className="opacity-60">Not triggered ({inactive.length}):</span>
					<span>{inactive.map(([key]) => formatComponentNameShort(key)).join(', ')}</span>
				</div>
			)}
		</>
	);
}

function formatComponentName(key: string, component: RiskComponent): string {
	const names: Record<string, string> = {
		tokenReplay: 'Token Replay',
		emailFraud: 'Email Fraud',
		ephemeralId: 'Device Tracking',
		validationFrequency: 'Validation Frequency',
		ipDiversity: 'IP Diversity',
		ja4SessionHopping: 'Session Hopping',
		ipRateLimit: 'IP Rate Limit',
		headerFingerprint: 'Header Fingerprint Reuse',
		tlsAnomaly: 'TLS Fingerprint Anomaly',
		latencyMismatch: 'Latency / Device Mismatch',
	};
	const label = names[key] || key;
	const weightPercent = (component.weight * 100).toFixed(0);
	return `${label} (${weightPercent}%)`;
}

function renderFingerprintInsights(breakdown: RiskBreakdown, config?: FraudDetectionConfig) {
	const details = breakdown.fingerprintDetails;
	const warnings = breakdown.fingerprintWarnings || [];
	const hasDetails = details && Object.values(details).some(Boolean);

	if (!hasDetails && warnings.length === 0) {
		return null;
	}

	const headerTriggered = (breakdown.components.headerFingerprint?.score ?? 0) > 0;
	const tlsTriggered = (breakdown.components.tlsAnomaly?.score ?? 0) > 0;
	const latencyTriggered = (breakdown.components.latencyMismatch?.score ?? 0) > 0;

	const headerConfig = config?.fingerprint.headerReuse;
	const tlsConfig = config?.fingerprint.tlsAnomaly;
	const latencyConfig = config?.fingerprint.latency;

	return (
		<div className="space-y-3 border-t border-border/70 pt-3 mt-4">
			<div className="flex items-center gap-2 text-sm font-semibold">
				<FingerprintIcon className="h-4 w-4 text-primary" />
				<span>Fingerprint Insights</span>
			</div>

			{warnings.length > 0 && (
				<div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md p-3">
					<AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
					<ul className="space-y-1 list-disc pl-4">
						{warnings.map((warning, idx) => (
							<li key={`fp-warning-${idx}`}>{warning}</li>
						))}
					</ul>
				</div>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{details?.headerReuse && (
					<div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs space-y-2">
						<div className="flex items-center justify-between text-sm font-semibold text-foreground">
							<span>Header Fingerprint Reuse</span>
							<Badge variant={headerTriggered ? 'destructive' : 'secondary'}>{headerTriggered ? 'Triggered' : 'Learning'}</Badge>
						</div>
						<div className="grid grid-cols-3 gap-2 text-muted-foreground">
							<div>
								<p className="text-base font-semibold text-foreground">{details.headerReuse.total ?? 0}</p>
								<p>Requests ({headerConfig?.windowMinutes ?? 60}m)</p>
							</div>
							<div>
								<p className="text-base font-semibold text-foreground">{details.headerReuse.ipCount ?? 0}</p>
								<p>Unique IPs</p>
							</div>
							<div>
								<p className="text-base font-semibold text-foreground">{details.headerReuse.ja4Count ?? 0}</p>
								<p>Unique JA4</p>
							</div>
						</div>
						{headerConfig && (
							<p className="text-[11px] text-muted-foreground">
								Threshold: ≥{headerConfig.minRequests} requests across ≥{headerConfig.minDistinctIps} IPs and ≥{headerConfig.minDistinctJa4}{' '}
								JA4 fingerprints.
							</p>
						)}
					</div>
				)}

				{details?.tlsAnomaly && (
					<div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs space-y-2">
						<div className="flex items-center justify-between text-sm font-semibold text-foreground">
							<span>TLS Fingerprint Baseline</span>
							<Badge variant={tlsTriggered ? 'destructive' : 'secondary'}>{tlsTriggered ? 'Mismatch' : 'Baseline'}</Badge>
						</div>
						<div className="grid grid-cols-2 gap-2 text-muted-foreground">
							<div>
								<p className="text-base font-semibold text-foreground">
									{details.tlsAnomaly.ja4Count !== undefined && details.tlsAnomaly.ja4Count >= 0 ? details.tlsAnomaly.ja4Count : 'Cached'}
								</p>
								<p>{details.tlsAnomaly.ja4Count === -1 ? 'Baseline stored' : 'JA4 samples (24h)'}</p>
							</div>
							<div>
								<p className="text-base font-semibold text-foreground">{details.tlsAnomaly.pairCount ?? '—'}</p>
								<p>Matching TLS pairs</p>
							</div>
						</div>
						{tlsConfig && (
							<p className="text-[11px] text-muted-foreground">
								Requires ≥{tlsConfig.minJa4Observations} JA4 observations in the last {tlsConfig.baselineHours}h before anomaly checks
								enforce.
							</p>
						)}
					</div>
				)}

				{details?.latency && (
					<div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs space-y-2 md:col-span-2">
						<div className="flex items-center justify-between text-sm font-semibold text-foreground">
							<span>Latency vs. Device Claim</span>
							<Badge variant={latencyTriggered ? 'destructive' : 'secondary'}>{latencyTriggered ? 'Mismatch' : 'Consistent'}</Badge>
						</div>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-muted-foreground">
							<div>
								<p className="text-base font-semibold text-foreground">
									{typeof details.latency.rtt === 'number' ? `${details.latency.rtt}ms` : 'N/A'}
								</p>
								<p>Client RTT</p>
							</div>
							<div>
								<p className="text-base font-semibold text-foreground">{details.latency.platform || 'Unknown'}</p>
								<p>Reported Platform</p>
							</div>
							<div>
								<p className="text-base font-semibold text-foreground">{details.latency.deviceType || 'Unknown'}</p>
								<p>Device Type</p>
							</div>
							<div>
								<p className="text-base font-semibold text-foreground">{details.latency.claimedMobile ? 'Yes' : 'No'}</p>
								<p>Claims Mobile</p>
							</div>
						</div>
						{latencyConfig && (
							<p className="text-[11px] text-muted-foreground">
								Mobile claims must exceed {latencyConfig.mobileRttThresholdMs}ms RTT unless device type reports mobile hardware. Datacenter
								ASN flagged: {details.latency.suspectAsn ? 'Yes' : 'No'}.
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
