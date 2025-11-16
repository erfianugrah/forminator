import type { ColumnDef } from '@tanstack/react-table';
import type { Submission } from '../../../hooks/useSubmissions';
import { Badge } from '../../ui/badge';
import { ArrowUpDown } from 'lucide-react';

export function createSubmissionColumns(
	loadSubmissionDetail: (id: number) => void
): ColumnDef<Submission, any>[] {
	return [
		{
			accessorKey: 'id',
			header: 'ID',
			cell: ({ row }) => (
				<span className="text-xs font-mono text-muted-foreground">#{row.original.id}</span>
			),
		},
		{
			accessorKey: 'first_name',
			header: 'Name',
			cell: ({ row }) => (
				<span className="text-sm">
					{row.original.first_name} {row.original.last_name}
				</span>
			),
		},
		{
			accessorKey: 'email',
			header: 'Email',
			cell: ({ row }) => <span className="text-xs">{row.original.email}</span>,
		},
		{
			accessorKey: 'country',
			header: 'Country',
			cell: ({ row }) => <span>{row.original.country || 'N/A'}</span>,
		},
		{
			accessorKey: 'remote_ip',
			header: 'IP',
			cell: ({ row }) => (
				<span className="font-mono text-xs">{row.original.remote_ip || 'N/A'}</span>
			),
		},
		{
			accessorKey: 'risk_score',
			header: ({ column }) => (
				<button
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					className="flex items-center gap-1 hover:underline"
				>
					Risk Score
					<ArrowUpDown className="h-3 w-3" />
				</button>
			),
			cell: ({ row }) => {
				const score = row.original.risk_score || 0;
				const variant =
					score >= 70
						? 'destructive'
						: score >= 40
						? 'default'
						: 'secondary';
				const color =
					score >= 70
						? 'text-red-600 dark:text-red-400'
						: score >= 40
						? 'text-yellow-600 dark:text-yellow-400'
						: 'text-green-600 dark:text-green-400';

				return (
					<Badge variant={variant} className={`font-mono ${color}`}>
						{score}/100
					</Badge>
				);
			},
			sortingFn: 'basic',
		},
		{
			accessorKey: 'bot_score',
			header: 'Bot Score',
			cell: ({ row }) => {
				const score = row.original.bot_score;
				return (
					<span
						className={`font-semibold ${
							score && score < 30
								? 'text-destructive'
								: score && score >= 70
								? 'text-green-600 dark:text-green-400'
								: 'text-yellow-600 dark:text-yellow-400'
						}`}
					>
						{score !== null ? score : 'N/A'}
					</span>
				);
			},
		},
		{
			accessorKey: 'created_at',
			header: 'Date',
			cell: ({ row }) => (
				<span className="text-xs">{new Date(row.original.created_at).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
			),
		},
		{
			id: 'actions',
			header: 'Actions',
			cell: ({ row }) => (
				<button
					onClick={() => loadSubmissionDetail(row.original.id)}
					className="text-xs text-primary hover:underline"
				>
					View Details
				</button>
			),
		},
	];
}
