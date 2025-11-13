import { Label } from './ui/label';
import { Input } from './ui/input';

interface DateOfBirthInputProps {
	value?: string; // YYYY-MM-DD format
	onChange: (date: string) => void;
	disabled?: boolean;
	error?: boolean;
}

export function DateOfBirthInput({ value, onChange, disabled, error }: DateOfBirthInputProps) {
	// Calculate max date (18 years ago from today)
	const today = new Date();
	const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
		.toISOString()
		.split('T')[0];

	// Min date (120 years ago)
	const minDate = new Date(today.getFullYear() - 120, 0, 1).toISOString().split('T')[0];

	return (
		<div className="space-y-2">
			<Label htmlFor="dateOfBirth" className="text-sm font-medium">
				Date of Birth{' '}
				<span className="text-xs text-muted-foreground font-normal">(Optional, must be 18+)</span>
			</Label>
			<div className="">
				<Input
					id="dateOfBirth"
					type="date"
					value={value || ''}
					onChange={(e) => onChange(e.target.value)}
					disabled={disabled}
					min={minDate}
					max={maxDate}
					className={`h-11 
						${error ? 'border-destructive focus-visible:ring-destructive' : ''}
						dark:color-scheme-dark
					`}
					placeholder="YYYY-MM-DD"
				/>
			</div>
			<p className="text-xs text-muted-foreground">
				You must be at least 18 years old to register
			</p>
		</div>
	);
}
