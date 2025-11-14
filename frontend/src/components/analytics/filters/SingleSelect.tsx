import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface Option {
	value: string;
	label: string;
}

interface SingleSelectProps {
	options: Option[];
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	label?: string;
	className?: string;
}

/**
 * SingleSelect component for filtering by a single value
 * Similar to MultiSelect but for single selection
 */
export function SingleSelect({
	options,
	value,
	onChange,
	placeholder = 'Select...',
	label,
	className = '',
}: SingleSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const selectOption = (optionValue: string) => {
		onChange(optionValue);
		setIsOpen(false);
	};

	const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

	return (
		<div className={`relative ${className}`} ref={dropdownRef}>
			{label && (
				<label className="block text-sm font-medium text-foreground mb-1">{label}</label>
			)}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center justify-between w-full px-4 py-2 border border-border rounded-md bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
			>
				<span className={value === 'all' || !value ? 'text-muted-foreground text-sm' : 'text-sm'}>
					{selectedLabel}
				</span>
				<ChevronDown
					size={16}
					className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
				/>
			</button>

			{isOpen && (
				<div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-md shadow-lg z-50 max-h-80 overflow-hidden backdrop-blur-sm">
					<div className="overflow-y-auto p-2">
						{options.map((option) => {
							const isSelected = value === option.value;
							return (
								<button
									key={option.value}
									onClick={() => selectOption(option.value)}
									className="w-full flex items-center justify-between px-3 py-2 text-sm rounded text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
								>
									<span>{option.label}</span>
									{isSelected && (
										<Check size={16} className="text-primary" />
									)}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
