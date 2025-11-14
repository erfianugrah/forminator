import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/card';
import type { BlockedValidation } from '../../../hooks/useBlockedValidations';

interface BlockedValidationsSectionProps {
	validations: BlockedValidation[];
}

export function BlockedValidationsSection({ validations }: BlockedValidationsSectionProps) {
	const getRiskColor = (score: number) => {
		if (score >= 90) return 'text-red-600 dark:text-red-400';
		if (score >= 70) return 'text-orange-600 dark:text-orange-400';
		return 'text-yellow-600 dark:text-yellow-400';
	};

	const getDetectionTypeBadge = (detectionType: string) => {
		switch (detectionType) {
			case 'ja4_fraud':
				return (
					<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
						JA4 Session Hopping
					</span>
				);
			case 'ephemeral_fraud':
				return (
					<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
						Ephemeral ID
					</span>
				);
			case 'ip_fraud':
				return (
					<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
						IP Fraud
					</span>
				);
			default:
				return (
					<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
						Other
					</span>
				);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Recent Blocked Validation Attempts</CardTitle>
				<CardDescription>
					Recent attempts blocked by fraud detection ({validations.length} shown)
				</CardDescription>
			</CardHeader>
			<CardContent>
				{validations.length === 0 ? (
					<div className="flex items-center justify-center py-12">
						<p className="text-muted-foreground text-sm">No blocked validation attempts</p>
					</div>
				) : (
					<>
						<div className="mb-4 text-sm text-muted-foreground">
							Showing {Math.min(validations.length, 20)} of {validations.length} attempts
						</div>
						<div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
							{validations.slice(0, 20).map((validation) => (
								<div
									key={validation.id}
									className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
								>
									<div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 text-sm min-w-0">
										<div className="min-w-0">
											<span className="text-muted-foreground block text-xs">IP Address</span>
											<p className="font-mono text-xs mt-1">
												{validation.ip_address}
											</p>
										</div>
										<div className="min-w-0">
											<span className="text-muted-foreground block text-xs">Detection Type</span>
											<div className="mt-1">
												{getDetectionTypeBadge(validation.detection_type)}
											</div>
										</div>
										<div className="min-w-0">
											<span className="text-muted-foreground block text-xs">Block Reason</span>
											<p className="font-medium mt-1 truncate" title={validation.block_reason}>
												{validation.block_reason}
											</p>
										</div>
										<div>
											<span className="text-muted-foreground block text-xs">Risk Score</span>
											<p className={`font-bold mt-1 ${getRiskColor(validation.risk_score)}`}>
												{validation.risk_score}
											</p>
										</div>
										<div>
											<span className="text-muted-foreground block text-xs">Timestamp</span>
											<p className="font-medium mt-1 text-xs">
												{new Date(validation.challenge_ts).toLocaleString()}
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
						{validations.length > 20 && (
							<div className="mt-4 text-center text-sm text-muted-foreground">
								Showing first 20 attempts. Total: {validations.length}
							</div>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}
