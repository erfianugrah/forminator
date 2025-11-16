import { Card, CardHeader, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';

interface RiskComponent {
	score: number;
	weight: number;
	contribution: number;
	reason: string;
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
	};
}

export function FraudAssessment({ breakdown }: { breakdown: RiskBreakdown }) {
	const { total, components } = breakdown;

	const severity = total >= 70 ? 'destructive' : total >= 40 ? 'default' : 'secondary';
	const severityColor =
		total >= 70
			? 'border-red-500 dark:border-red-400'
			: total >= 40
			? 'border-yellow-500 dark:border-yellow-400'
			: 'border-green-500 dark:border-green-400';

	return (
		<Card className={`border-l-4 ${severityColor}`}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-semibold">Fraud Risk Assessment</h3>
					<Badge variant={severity} className="text-lg font-mono">
						{total}/100
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Overall progress bar */}
				<div>
					<div className="flex justify-between text-sm mb-2">
						<span>Risk Score</span>
						<span className="font-mono">{total}/100</span>
					</div>
					<Progress value={total} className="h-3" />
				</div>

				{/* Component breakdown */}
				<div className="space-y-3">
					<h4 className="font-semibold text-sm">Contributing Factors:</h4>

					{Object.entries(components).map(([key, component]) =>
						component ? (
							<ComponentCard
								key={key}
								name={formatComponentName(key)}
								component={component}
							/>
						) : null
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function ComponentCard({ name, component }: { name: string; component: RiskComponent }) {
	if (component.score === 0) return null;

	const color =
		component.score >= 70
			? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
			: component.score >= 40
			? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950'
			: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900';

	return (
		<div className={`border rounded-lg p-3 ${color}`}>
			<div className="flex items-center justify-between mb-2">
				<span className="font-medium text-sm">{name}</span>
				<Badge variant="outline" className="font-mono">
					{component.score}/100
				</Badge>
			</div>

			<div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
				<div>• {component.reason}</div>
				<div>• Weight: {(component.weight * 100).toFixed(0)}%</div>
				<div>• Contribution: {component.contribution.toFixed(1)} points</div>
			</div>
		</div>
	);
}

function formatComponentName(key: string): string {
	const names: Record<string, string> = {
		tokenReplay: 'Token Replay',
		emailFraud: 'Email Fraud',
		ephemeralId: 'Ephemeral ID Pattern',
		validationFrequency: 'Validation Frequency',
		ipDiversity: 'IP Diversity',
		ja4SessionHopping: 'JA4 Session Hopping',
	};
	return names[key] || key;
}
