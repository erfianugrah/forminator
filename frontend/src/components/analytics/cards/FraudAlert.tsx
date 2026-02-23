import { AlertTriangle, Shield, Activity, Globe, Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/card';
import { Alert, AlertDescription } from '../../ui/alert';
import { Badge } from '../../ui/badge';

interface FraudPattern {
	blacklisted: any[];
	high_risk_ephemeral: any[];
	proxy_rotation: any[];
	high_frequency: any[];
}

interface FraudAlertProps {
	data: FraudPattern | null;
	loading?: boolean;
}

/**
 * FraudAlert displays ephemeral ID-based fraud patterns
 * Aligns with fraud detection in src/routes/submissions.ts:96-242
 * Shows: blacklisted IDs, high-risk patterns, proxy rotation, and high-frequency validators
 */
export function FraudAlert({ data, loading }: FraudAlertProps) {
	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Shield size={20} className="text-yellow-600" />
						Ephemeral ID Fraud Detection
					</CardTitle>
					<CardDescription>Analyzing for suspicious patterns</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">Loading...</p>
				</CardContent>
			</Card>
		);
	}

	if (!data) {
		return null;
	}

	const totalAlerts = data.blacklisted.length + data.high_risk_ephemeral.length + data.proxy_rotation.length + data.high_frequency.length;

	if (totalAlerts === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Shield size={20} className="text-green-600 dark:text-green-400" />
						Ephemeral ID Fraud Detection
					</CardTitle>
					<CardDescription>No suspicious patterns detected</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						All ephemeral IDs appear legitimate. No blacklisted IDs, proxy rotation, or abuse patterns detected.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Shield size={20} className="text-yellow-600" />
					Ephemeral ID Fraud Detection
				</CardTitle>
				<CardDescription>
					{totalAlerts} suspicious {totalAlerts === 1 ? 'pattern' : 'patterns'} detected
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Blacklisted Ephemeral IDs */}
				{data.blacklisted.length > 0 && (
					<Alert className="border-red-600">
						<AlertDescription>
							<div className="font-semibold mb-2 flex items-center gap-2">
								<AlertTriangle size={16} className="text-red-600" />
								Blacklisted Ephemeral IDs ({data.blacklisted.length})
							</div>
							<div className="space-y-2 text-sm">
								{data.blacklisted.slice(0, 3).map((item: any, index: number) => {
									const parsed = parseBlacklistReason(item.block_reason || '');
									return (
										<div key={index} className="p-3 bg-secondary rounded-lg border border-red-600/20 space-y-2">
											{/* Header: Ephemeral ID + Confidence */}
											<div className="flex justify-between items-start gap-2">
												<span className="font-mono text-xs break-all text-foreground">{item.ephemeral_id || item.ip_address}</span>
												<Badge
													variant={item.confidence === 'high' ? 'destructive' : 'default'}
													className="flex-shrink-0"
												>
													{item.confidence}
												</Badge>
											</div>

											{/* Risk Score */}
											{parsed.riskScore !== undefined && (
												<div className="flex items-center gap-2">
													<span className="text-xs text-muted-foreground">Risk Score:</span>
													<span
														className={`text-sm font-semibold ${
															parsed.riskScore >= 70
																? 'text-red-600 dark:text-red-400'
																: parsed.riskScore >= 40
																	? 'text-yellow-600 dark:text-yellow-400'
																	: 'text-green-600 dark:text-green-400'
														}`}
													>
														{parsed.riskScore}
														{parsed.threshold !== undefined && (
															<span className="text-xs font-normal text-muted-foreground ml-1">
																/ {parsed.threshold} threshold
															</span>
														)}
													</span>
												</div>
											)}

											{/* Trigger Pills */}
											{parsed.triggers.length > 0 && (
												<div className="flex flex-wrap gap-1.5">
													{parsed.triggers.map((trigger, idx) => (
														<span
															key={idx}
															className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${getTriggerColor(trigger)}`}
														>
															{trigger}
														</span>
													))}
												</div>
											)}

											{/* Top Components */}
											{parsed.topComponents.length > 0 && (
												<div className="flex flex-wrap gap-1.5">
													{parsed.topComponents.map((comp) => (
														<span
															key={comp.name}
															className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono bg-muted border border-border"
														>
															<span className="text-muted-foreground">{formatComponentName(comp.name)}</span>
															<span className="font-semibold">{comp.score}</span>
														</span>
													))}
												</div>
											)}

											{/* Meta: submissions + expiry */}
											<div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
												<span>Submissions: {item.submission_count}</span>
												<span>•</span>
												<span>
													Expires:{' '}
													{new Date(item.expires_at).toLocaleString('en-US', {
														year: 'numeric',
														month: '2-digit',
														day: '2-digit',
														hour: '2-digit',
														minute: '2-digit',
														second: '2-digit',
														hour12: false,
													})}
												</span>
											</div>
										</div>
									);
								})}
								{data.blacklisted.length > 3 && (
									<div className="text-xs text-muted-foreground">+{data.blacklisted.length - 3} more blocked IDs</div>
								)}
							</div>
						</AlertDescription>
					</Alert>
				)}

				{/* High-Risk Ephemeral IDs (3+ submissions in 1 hour) */}
				{data.high_risk_ephemeral.length > 0 && (
					<Alert className="border-orange-600">
						<AlertDescription>
							<div className="font-semibold mb-2 flex items-center gap-2">
								<Activity size={16} className="text-orange-600" />
								High-Risk Ephemeral IDs ({data.high_risk_ephemeral.length})
							</div>
							<div className="text-xs text-muted-foreground mb-2">
								Ephemeral IDs with 3+ submissions in 1 hour (threshold: src/lib/turnstile.ts:178)
							</div>
							<div className="space-y-2 text-sm">
								{data.high_risk_ephemeral.slice(0, 3).map((item: any, index: number) => (
									<div key={index} className="p-2 bg-secondary rounded border border-orange-600/20">
										<div className="flex justify-between">
											<span className="font-mono text-xs break-all">{item.ephemeral_id}</span>
											<span className="text-destructive font-semibold">{item.submission_count} submissions</span>
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											{item.unique_ips} unique IPs • {item.countries || 'Unknown countries'}
										</div>
										<div className="text-xs text-muted-foreground">Timespan: {item.time_span_minutes?.toFixed(1) || '0'} minutes</div>
									</div>
								))}
								{data.high_risk_ephemeral.length > 3 && (
									<div className="text-xs text-muted-foreground">+{data.high_risk_ephemeral.length - 3} more high-risk IDs</div>
								)}
							</div>
						</AlertDescription>
					</Alert>
				)}

				{/* Proxy Rotation (same ephemeral ID from multiple IPs) */}
				{data.proxy_rotation.length > 0 && (
					<Alert className="border-purple-600">
						<AlertDescription>
							<div className="font-semibold mb-2 flex items-center gap-2">
								<Globe size={16} className="text-purple-600" />
								Proxy Rotation Detected ({data.proxy_rotation.length})
							</div>
							<div className="text-xs text-muted-foreground mb-2">
								Same ephemeral ID from 3+ different IPs - possible botnet/proxy (src/lib/turnstile.ts:202)
							</div>
							<div className="space-y-2 text-sm">
								{data.proxy_rotation.slice(0, 3).map((item: any, index: number) => (
									<div key={index} className="p-2 bg-secondary rounded border border-purple-600/20">
										<div className="flex justify-between">
											<span className="font-mono text-xs break-all">{item.ephemeral_id}</span>
											<span className="text-purple-600 font-semibold">{item.unique_ips} IPs</span>
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											{item.submission_count} submissions • {item.countries || 'Unknown countries'}
										</div>
										<div className="text-xs text-muted-foreground font-mono mt-1 truncate" title={item.ip_addresses}>
											IPs: {item.ip_addresses}
										</div>
									</div>
								))}
								{data.proxy_rotation.length > 3 && (
									<div className="text-xs text-muted-foreground">+{data.proxy_rotation.length - 3} more proxy rotation patterns</div>
								)}
							</div>
						</AlertDescription>
					</Alert>
				)}

				{/* High-Frequency Validators (10+ attempts in 1 hour) */}
				{data.high_frequency.length > 0 && (
					<Alert className="border-yellow-600">
						<AlertDescription>
							<div className="font-semibold mb-2 flex items-center gap-2">
								<Zap size={16} className="text-yellow-600" />
								High-Frequency Validators ({data.high_frequency.length})
							</div>
							<div className="text-xs text-muted-foreground mb-2">
								Ephemeral IDs with 10+ validation attempts in 1 hour - possible bot (src/lib/turnstile.ts:221)
							</div>
							<div className="space-y-2 text-sm">
								{data.high_frequency.slice(0, 3).map((item: any, index: number) => (
									<div key={index} className="p-2 bg-secondary rounded border border-yellow-600/20">
										<div className="flex justify-between">
											<span className="font-mono text-xs break-all">{item.ephemeral_id}</span>
											<span className="text-yellow-600 font-semibold">{item.validation_count} attempts</span>
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											Success: {item.successful_validations} • Failed: {item.failed_validations}
										</div>
										<div className="text-xs text-muted-foreground">
											{item.unique_ips} unique IPs • Timespan: {item.time_span_minutes?.toFixed(1) || '0'} minutes
										</div>
									</div>
								))}
								{data.high_frequency.length > 3 && (
									<div className="text-xs text-muted-foreground">+{data.high_frequency.length - 3} more high-frequency validators</div>
								)}
							</div>
						</AlertDescription>
					</Alert>
				)}
			</CardContent>
		</Card>
	);
}

// ========== HELPERS ==========

const COMPONENT_LABELS: Record<string, string> = {
	tokenReplay: 'Token Replay',
	emailFraud: 'Email Fraud',
	ephemeralId: 'Device Tracking',
	validationFrequency: 'Validation Freq',
	ipDiversity: 'IP Diversity',
	ja4SessionHopping: 'Session Hopping',
	ipRateLimit: 'IP Rate Limit',
	headerFingerprint: 'Header FP',
	tlsAnomaly: 'TLS Anomaly',
	latencyMismatch: 'Latency Mismatch',
};

function formatComponentName(key: string): string {
	return COMPONENT_LABELS[key] || key;
}

function parseBlacklistReason(blockReason: string): {
	riskScore?: number;
	threshold?: number;
	triggers: string[];
	topComponents: Array<{ name: string; score: number }>;
} {
	const riskScoreMatch = blockReason.match(/Risk score (\d+(?:\.\d+)?) >= (\d+)/);
	const riskScore = riskScoreMatch ? parseFloat(riskScoreMatch[1]) : undefined;
	const threshold = riskScoreMatch ? parseInt(riskScoreMatch[2], 10) : undefined;

	const triggersMatch = blockReason.match(/Triggers:\s*(.+?)(?:\.\s*Top components:|$)/);
	const topComponentsMatch = blockReason.match(/Top components:\s*(.+)$/);

	let triggers: string[] = [];
	if (triggersMatch) {
		triggers = triggersMatch[1]
			.split(/,\s*/)
			.map((t) => t.trim())
			.filter(Boolean);
	}

	let topComponents: Array<{ name: string; score: number }> = [];
	if (topComponentsMatch) {
		topComponents = topComponentsMatch[1]
			.split(/,\s*/)
			.map((pair) => {
				const m = pair.match(/^(\w+)=(\d+)/);
				if (!m) return null;
				return { name: m[1], score: parseInt(m[2], 10) };
			})
			.filter((x): x is { name: string; score: number } => x !== null);
	}

	return { riskScore, threshold, triggers, topComponents };
}

function getTriggerColor(trigger: string): string {
	const lower = trigger.toLowerCase();
	if (lower.includes('email')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
	if (lower.includes('ja4') || lower.includes('session')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
	if (lower.includes('ip') || lower.includes('proxy')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
	if (lower.includes('velocity') || lower.includes('rapid') || lower.includes('frequency'))
		return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
	if (lower.includes('duplicate')) return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
	return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
}
