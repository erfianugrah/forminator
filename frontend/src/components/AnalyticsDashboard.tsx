import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

interface ValidationStats {
	total: number;
	successful: number;
	allowed: number;
	avg_risk_score: number;
	unique_ephemeral_ids: number;
}

interface Submission {
	id: number;
	first_name: string;
	last_name: string;
	email: string;
	country: string | null;
	city: string | null;
	bot_score: number | null;
	created_at: string;
}

interface CountryData {
	country: string;
	count: number;
}

interface BotScoreData {
	score_range: string;
	count: number;
}

export default function AnalyticsDashboard() {
	const [stats, setStats] = useState<ValidationStats | null>(null);
	const [submissions, setSubmissions] = useState<Submission[]>([]);
	const [countries, setCountries] = useState<CountryData[]>([]);
	const [botScores, setBotScores] = useState<BotScoreData[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadAnalytics();
	}, []);

	const loadAnalytics = async () => {
		setLoading(true);
		setError(null);

		try {
			const [statsRes, submissionsRes, countriesRes, botScoresRes] = await Promise.all([
				fetch('/api/analytics/stats'),
				fetch('/api/analytics/submissions?limit=10'),
				fetch('/api/analytics/countries'),
				fetch('/api/analytics/bot-scores'),
			]);

			if (!statsRes.ok || !submissionsRes.ok || !countriesRes.ok || !botScoresRes.ok) {
				throw new Error('Failed to fetch analytics');
			}

			const [statsData, submissionsData, countriesData, botScoresData] = await Promise.all([
				statsRes.json(),
				submissionsRes.json(),
				countriesRes.json(),
				botScoresRes.json(),
			]);

			setStats(statsData.data);
			setSubmissions(submissionsData.data);
			setCountries(countriesData.data);
			setBotScores(botScoresData.data);
		} catch (err) {
			console.error('Error loading analytics:', err);
			setError('Failed to load analytics data');
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<p className="text-muted-foreground">Loading analytics...</p>
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-6">
			{/* Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Validations
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{stats?.total || 0}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Success Rate
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">
							{stats && stats.total > 0
								? ((stats.successful / stats.total) * 100).toFixed(1)
								: 0}
							%
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Allowed Rate
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">
							{stats && stats.total > 0
								? ((stats.allowed / stats.total) * 100).toFixed(1)
								: 0}
							%
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Avg Risk Score
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">
							{stats?.avg_risk_score ? stats.avg_risk_score.toFixed(1) : '0.0'}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Recent Submissions */}
			<Card>
				<CardHeader>
					<CardTitle>Recent Submissions</CardTitle>
					<CardDescription>Latest form submissions</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b">
									<th className="text-left py-2 px-4">ID</th>
									<th className="text-left py-2 px-4">Name</th>
									<th className="text-left py-2 px-4">Email</th>
									<th className="text-left py-2 px-4">Country</th>
									<th className="text-left py-2 px-4">Bot Score</th>
									<th className="text-left py-2 px-4">Date</th>
								</tr>
							</thead>
							<tbody>
								{submissions.length === 0 ? (
									<tr>
										<td colSpan={6} className="text-center py-4 text-muted-foreground">
											No submissions yet
										</td>
									</tr>
								) : (
									submissions.map((sub) => (
										<tr key={sub.id} className="border-b hover:bg-muted/50">
											<td className="py-2 px-4">{sub.id}</td>
											<td className="py-2 px-4">
												{sub.first_name} {sub.last_name}
											</td>
											<td className="py-2 px-4">{sub.email}</td>
											<td className="py-2 px-4">{sub.country || 'N/A'}</td>
											<td className="py-2 px-4">
												<span
													className={`font-semibold ${
														sub.bot_score && sub.bot_score < 30
															? 'text-destructive'
															: sub.bot_score && sub.bot_score >= 70
															? 'text-green-600 dark:text-green-400'
															: 'text-yellow-600 dark:text-yellow-400'
													}`}
												>
													{sub.bot_score !== null ? sub.bot_score : 'N/A'}
												</span>
											</td>
											<td className="py-2 px-4">
												{new Date(sub.created_at).toLocaleString()}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>

			{/* Country Distribution and Bot Scores */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Submissions by Country</CardTitle>
						<CardDescription>Top countries</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{countries.length === 0 ? (
								<p className="text-muted-foreground">No data available</p>
							) : (
								countries.slice(0, 10).map((item) => (
									<div
										key={item.country}
										className="flex items-center justify-between py-2 border-b last:border-0"
									>
										<span className="font-medium">{item.country}</span>
										<span className="text-muted-foreground">{item.count}</span>
									</div>
								))
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Bot Score Distribution</CardTitle>
						<CardDescription>Score ranges</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{botScores.length === 0 ? (
								<p className="text-muted-foreground">No data available</p>
							) : (
								botScores.map((item) => (
									<div
										key={item.score_range}
										className="flex items-center justify-between py-2 border-b last:border-0"
									>
										<span className="font-medium">{item.score_range}</span>
										<span className="text-muted-foreground">{item.count}</span>
									</div>
								))
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
