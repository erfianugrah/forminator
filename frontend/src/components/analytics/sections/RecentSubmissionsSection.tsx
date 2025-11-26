import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/card';
import { SearchBar } from '../filters/SearchBar';
import { DateRangePicker } from '../filters/DateRangePicker';
import { MultiSelect } from '../filters/MultiSelect';
import { SingleSelect } from '../filters/SingleSelect';
import { RangeSlider } from '../filters/RangeSlider';
import { DataTable } from '../tables/DataTable';
import { createSubmissionColumns } from '../tables/columns';
import { RiskScoreInfo } from '../RiskScoreInfo';
import { subDays } from 'date-fns';
import type { CountryData } from '../../../hooks/useAnalytics';
import type { Submission } from '../../../hooks/useSubmissions';
import type { PaginationState, SortingState } from '@tanstack/react-table';
import { downloadJson } from '../../../lib/download';

interface RecentSubmissionsSectionProps {
	submissions: Submission[];
	totalCount: number;
	countries: CountryData[];
	loading: boolean;
	onLoadDetail: (id: number) => void;
	// Filter states
	searchQuery: string;
	onSearchQueryChange: (query: string) => void;
	selectedCountries: string[];
	onSelectedCountriesChange: (countries: string[]) => void;
	botScoreRange: [number, number];
	onBotScoreRangeChange: (range: [number, number]) => void;
	allowedStatus: 'all' | 'allowed' | 'blocked';
	onAllowedStatusChange: (status: 'all' | 'allowed' | 'blocked') => void;
	dateRange: { start: Date; end: Date };
	onDateRangeChange: (range: { start: Date; end: Date }) => void;
	fingerprintFlags: {
		headerReuse: boolean;
		tlsAnomaly: boolean;
		latencyMismatch: boolean;
	};
	onFingerprintFlagsChange: (flags: { headerReuse: boolean; tlsAnomaly: boolean; latencyMismatch: boolean }) => void;
	// Pagination/sorting states
	pagination: PaginationState;
	onPaginationChange: (updater: PaginationState | ((old: PaginationState) => PaginationState)) => void;
	sorting: SortingState;
	onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
	apiKey: string;
}

export function RecentSubmissionsSection({
	submissions,
	totalCount,
	countries,
	loading,
	onLoadDetail,
	searchQuery,
	onSearchQueryChange,
	selectedCountries,
	onSelectedCountriesChange,
	botScoreRange,
	onBotScoreRangeChange,
	allowedStatus,
	onAllowedStatusChange,
	dateRange,
	onDateRangeChange,
	fingerprintFlags,
	onFingerprintFlagsChange,
	pagination,
	onPaginationChange,
	sorting,
	onSortingChange,
	apiKey,
}: RecentSubmissionsSectionProps) {
	const [exportingAll, setExportingAll] = useState(false);
	const [exportingSubmissionId, setExportingSubmissionId] = useState<number | null>(null);
	const [exportError, setExportError] = useState<string | null>(null);
	const columns = createSubmissionColumns(onLoadDetail, handleExportSubmission, exportingSubmissionId);

	async function handleExportSubmission(submissionId: number) {
		if (!apiKey) return;
		setExportError(null);
		setExportingSubmissionId(submissionId);
		try {
			const response = await fetch(`/api/analytics/submissions/${submissionId}`, {
				headers: { 'X-API-KEY': apiKey },
			});

			if (!response.ok) {
				throw new Error('Failed to export submission');
			}

			const data = await response.json() as { data?: unknown };
			downloadJson(`submission-${submissionId}.json`, {
				exportedAt: new Date().toISOString(),
				data: data.data ?? data,
			});
		} catch (error) {
			console.error('Error exporting submission:', error);
			setExportError('Unable to export submission JSON');
		} finally {
			setExportingSubmissionId(null);
		}
	}

	async function handleExportAllSubmissions() {
		if (!apiKey) return;
		setExportError(null);
		setExportingAll(true);

		try {
			const params = new URLSearchParams();
			params.append('format', 'json');
			if (sorting.length > 0) {
				params.append('sortBy', sorting[0].id);
				params.append('sortOrder', sorting[0].desc ? 'desc' : 'asc');
			}
			if (searchQuery.trim()) {
				params.append('search', searchQuery.trim());
			}
			if (selectedCountries.length > 0) {
				params.append('countries', selectedCountries.join(','));
			}
			if (botScoreRange[0] !== 0 || botScoreRange[1] !== 100) {
				params.append('botScoreMin', botScoreRange[0].toString());
				params.append('botScoreMax', botScoreRange[1].toString());
			}
			params.append('startDate', dateRange.start.toISOString());
			params.append('endDate', dateRange.end.toISOString());
			if (allowedStatus !== 'all') {
				params.append('allowed', allowedStatus === 'allowed' ? 'true' : 'false');
			}
			if (fingerprintFlags.headerReuse) params.append('fingerprintHeader', 'true');
			if (fingerprintFlags.tlsAnomaly) params.append('fingerprintTls', 'true');
			if (fingerprintFlags.latencyMismatch) params.append('fingerprintLatency', 'true');

			const response = await fetch(`/api/analytics/export?${params.toString()}`, {
				headers: { 'X-API-KEY': apiKey },
			});

				if (!response.ok) {
					const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
					throw new Error(errorPayload?.message || 'Failed to export submissions');
				}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			const fileName = `submissions-export-${new Date().toISOString().split('T')[0]}.json`;
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Error exporting submissions:', error);
			setExportError('Unable to export submissions JSON');
		} finally {
			setExportingAll(false);
		}
	}

	return (
		<Card>
			<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<CardTitle>Recent Submissions</CardTitle>
					<CardDescription>
						Search and filter form submissions (click row for full details)
					</CardDescription>
				</div>
				<button
					onClick={handleExportAllSubmissions}
					disabled={exportingAll}
					className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed"
				>
					{exportingAll ? 'Exporting…' : 'Export JSON'}
				</button>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Risk Score Info */}
				<RiskScoreInfo />

				{/* Filters */}
				<div className="space-y-5">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						<SearchBar
							value={searchQuery}
							onChange={onSearchQueryChange}
							placeholder="Search by email, name, or IP..."
						/>
						<SingleSelect
							options={[
								{ value: 'all', label: 'All Submissions' },
							{ value: 'allowed', label: 'Allowed Only' },
							{ value: 'blocked', label: 'Blocked Only' },
							]}
							value={allowedStatus}
							onChange={(value) => onAllowedStatusChange(value as 'all' | 'allowed' | 'blocked')}
							placeholder="Filter by status..."
						/>
						<MultiSelect
							options={countries.map((c) => ({ value: c.country, label: c.country }))}
							value={selectedCountries}
							onChange={onSelectedCountriesChange}
							placeholder="Filter by countries..."
						/>
						<DateRangePicker value={dateRange} onChange={onDateRangeChange} />
					</div>
					<div className="w-full max-w-2xl">
						<RangeSlider
							min={0}
							max={100}
							value={botScoreRange}
							onChange={onBotScoreRangeChange}
							label="Bot Score Range"
							step={1}
						/>
					</div>
					<div className="flex flex-wrap gap-4 text-sm">
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={fingerprintFlags.headerReuse}
								onChange={(e) => onFingerprintFlagsChange({ ...fingerprintFlags, headerReuse: e.target.checked })}
							/>
							<span>Header Fingerprint Reuse</span>
						</label>
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={fingerprintFlags.tlsAnomaly}
								onChange={(e) => onFingerprintFlagsChange({ ...fingerprintFlags, tlsAnomaly: e.target.checked })}
							/>
							<span>TLS Anomaly</span>
						</label>
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={fingerprintFlags.latencyMismatch}
								onChange={(e) => onFingerprintFlagsChange({ ...fingerprintFlags, latencyMismatch: e.target.checked })}
							/>
							<span>Latency Mismatch</span>
						</label>
					</div>
				</div>
				{exportError && (
					<p className="text-xs text-destructive -mt-2">{exportError}</p>
				)}

				{/* Data Table */}
				{loading ? (
					<div className="flex items-center justify-center py-16">
						<p className="text-muted-foreground">Loading submissions...</p>
					</div>
				) : (
					<DataTable
						data={submissions}
						columns={columns}
						totalCount={totalCount}
						manualPagination={true}
						manualSorting={true}
						pagination={pagination}
						sorting={sorting}
						onPaginationChange={onPaginationChange}
						onSortingChange={onSortingChange}
					/>
				)}
			</CardContent>
		</Card>
	);
}
