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

export function RiskScoreInfo() {
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
					<div className="flex items-start gap-2">
						<Mail className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">Email Fraud (14%)</p>
							<p className="text-muted-foreground">ML pattern detection (Markov Chain, 83% accuracy)</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<Fingerprint className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">Device Tracking (15%)</p>
							<p className="text-muted-foreground">Ephemeral ID tracks same device (a few days)</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<Clock className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">Validation Frequency (10%)</p>
							<p className="text-muted-foreground">Rapid-fire detection (3+ attempts in 1h)</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<Network className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">IP Diversity (7%)</p>
							<p className="text-muted-foreground">Proxy rotation (2+ IPs from same device)</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<AlertCircle className="h-4 w-4 text-pink-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">Session Hopping (6%)</p>
							<p className="text-muted-foreground">JA4 fingerprint detects incognito/browser switching</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<Shield className="h-4 w-4 text-cyan-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">IP Rate Limit (7%)</p>
							<p className="text-muted-foreground">Browser-switching detection (3 per hour from same IP)</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<Layers className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">Header Fingerprint (7%)</p>
							<p className="text-muted-foreground">Shared header stacks across JA4/IP/email clusters</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<Lock className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">TLS Anomaly (4%)</p>
							<p className="text-muted-foreground">JA4 presents unknown TLS ClientHello fingerprint</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<Smartphone className="h-4 w-4 text-lime-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">Latency Mismatch (2%)</p>
							<p className="text-muted-foreground">Claimed mobile devices with impossible RTT/device type</p>
						</div>
					</div>
				</div>

				<div className="pt-2 border-t border-border space-y-2">
					<div className="flex items-start gap-1.5 text-xs text-muted-foreground">
						<Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
						<p>
							Token replay (28%) still triggers instantly via validation logs; submissions reflect the remaining nine
							behavioral/fingerprint components (72% total).
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
