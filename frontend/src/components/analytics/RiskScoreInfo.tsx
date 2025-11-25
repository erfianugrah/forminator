import type { ComponentType, SVGProps } from 'react';
import {
	AlertCircle,
	Shield,
	Mail,
	Fingerprint,
	Clock,
	Network,
	Info,
	Layers,
	Lock,
	Smartphone,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { useConfig } from '../../hooks/useConfig';
import type { FraudDetectionConfig } from '../../hooks/useConfig';

type WeightKey = keyof FraudDetectionConfig['risk']['weights'];
type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const componentDetails: Array<{
	key: WeightKey;
	label: string;
	description: string;
	icon: IconType;
	color: string;
}> = [
	{
		key: 'emailFraud',
		label: 'Email Fraud',
		description: 'ML pattern detection (Markov Chain, 83% accuracy)',
		icon: Mail,
		color: 'text-yellow-500',
	},
	{
		key: 'ephemeralId',
		label: 'Device Tracking',
		description: 'Ephemeral ID tracks same device (a few days)',
		icon: Fingerprint,
		color: 'text-orange-500',
	},
	{
		key: 'validationFrequency',
		label: 'Validation Frequency',
		description: 'Rapid-fire detection (3+ attempts in 1h)',
		icon: Clock,
		color: 'text-blue-500',
	},
	{
		key: 'ipDiversity',
		label: 'IP Diversity',
		description: 'Proxy rotation (2+ IPs from same device)',
		icon: Network,
		color: 'text-purple-500',
	},
	{
		key: 'ja4SessionHopping',
		label: 'Session Hopping',
		description: 'JA4 fingerprint detects incognito/browser switching',
		icon: AlertCircle,
		color: 'text-pink-500',
	},
	{
		key: 'ipRateLimit',
		label: 'IP Rate Limit',
		description: 'Browser-switching detection (3 per hour from same IP)',
		icon: Shield,
		color: 'text-cyan-500',
	},
	{
		key: 'headerFingerprint',
		label: 'Header Fingerprint',
		description: 'Shared header stacks across JA4/IP/email clusters',
		icon: Layers,
		color: 'text-rose-500',
	},
	{
		key: 'tlsAnomaly',
		label: 'TLS Anomaly',
		description: 'JA4 presents unknown TLS ClientHello fingerprint',
		icon: Lock,
		color: 'text-indigo-500',
	},
	{
		key: 'latencyMismatch',
		label: 'Latency Mismatch',
		description: 'Claimed mobile devices with impossible RTT/device type',
		icon: Smartphone,
		color: 'text-lime-500',
	},
];

export function RiskScoreInfo() {
	const { config } = useConfig();
	const weights = config.risk.weights;

	const formatWeight = (key: WeightKey) => `${Number((weights[key] * 100).toFixed(0))}%`;
	const tokenWeight = `${Number((weights.tokenReplay * 100).toFixed(0))}%`;
	const nonTokenPercent = `${Number(((1 - weights.tokenReplay) * 100).toFixed(0))}%`;

	return (
		<Card className="bg-muted/30">
			<CardHeader>
				<div className="flex items-start gap-2">
					<Shield className="h-5 w-5 text-primary mt-0.5" />
					<div>
						<h3 className="font-semibold text-sm">Behavioral Risk Scoring</h3>
						<p className="text-xs text-muted-foreground mt-1">
							Signals collected, weighted, and combined (block at ≥70/100) • Progressive timeouts (1h → 24h)
						</p>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
					{componentDetails.map(({ key, label, description, icon: Icon, color }) => (
						<div key={key} className="flex items-start gap-2">
							<Icon className={`h-4 w-4 ${color} mt-0.5 flex-shrink-0`} />
							<div>
								<p className="font-medium">
									{label} ({formatWeight(key)})
								</p>
								<p className="text-muted-foreground">{description}</p>
							</div>
						</div>
					))}
				</div>

				<div className="pt-2 border-t border-border space-y-2">
					<div className="flex items-start gap-1.5 text-xs text-muted-foreground">
						<Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
						<p>
							Token replay ({tokenWeight}) still triggers instantly via validation logs; submissions reflect the remaining nine
							behavioral/fingerprint components ({nonTokenPercent} total).
						</p>
					</div>
					<div className="flex items-center gap-4 text-xs flex-wrap">
						<div className="flex items-center gap-1.5">
							<div className="w-3 h-3 rounded-full bg-green-500/20 border-2 border-green-500" />
							<span className="text-muted-foreground">0-39: Low Risk</span>
						</div>
						<div className="flex items-center gap-1.5">
							<div className="w-3 h-3 rounded-full bg-yellow-500/20 border-2 border-yellow-500" />
							<span className="text-muted-foreground">40-69: Medium Risk</span>
						</div>
						<div className="flex items-center gap-1.5">
							<div className="w-3 h-3 rounded-full bg-red-500/20 border-2 border-red-500" />
							<span className="text-muted-foreground">70-100: High Risk (Blocked)</span>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
