import { AlertCircle, Shield, Mail, Fingerprint, Clock, Network, Target } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/card';

export function RiskScoreInfo() {
	return (
		<Card className="bg-muted/30">
			<CardHeader>
				<div className="flex items-start gap-2">
					<Shield className="h-5 w-5 text-primary mt-0.5" />
					<div>
						<h3 className="font-semibold text-sm">Risk Score Calculation</h3>
						<p className="text-xs text-muted-foreground mt-1">
							Each submission receives a normalized 0-100 risk score based on multiple fraud signals
						</p>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
					<div className="flex items-start gap-2">
						<Target className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">Token Replay (35%)</p>
							<p className="text-muted-foreground">Detects reused CAPTCHA tokens</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<Fingerprint className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">Device Tracking (18%)</p>
							<p className="text-muted-foreground">Tracks repeat submissions from same device</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<Mail className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">Email Fraud (17%)</p>
							<p className="text-muted-foreground">ML-based pattern detection</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<Clock className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">Validation Frequency (13%)</p>
							<p className="text-muted-foreground">Detects rapid-fire attempts</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<Network className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">IP Diversity (9%)</p>
							<p className="text-muted-foreground">Tracks proxy rotation</p>
						</div>
					</div>
					<div className="flex items-start gap-2">
						<AlertCircle className="h-4 w-4 text-pink-500 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">Session Hopping (8%)</p>
							<p className="text-muted-foreground">Detects browser switching</p>
						</div>
					</div>
				</div>
				<div className="pt-2 border-t border-border">
					<div className="flex items-center gap-4 text-xs">
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
