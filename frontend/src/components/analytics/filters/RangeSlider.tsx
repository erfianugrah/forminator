import { Slider } from '../../ui/slider';
import { Label } from '../../ui/label';

interface RangeSliderProps {
	min: number;
	max: number;
	value: [number, number];
	onChange: (value: [number, number]) => void;
	label?: string;
	step?: number;
	className?: string;
}

/**
 * RangeSlider component using shadcn Slider
 * Dual-thumb range selector with proper dark mode support
 */
export function RangeSlider({
	min,
	max,
	value,
	onChange,
	label,
	step = 1,
	className = '',
}: RangeSliderProps) {
	const handleValueChange = (newValue: number[]) => {
		onChange([newValue[0], newValue[1]]);
	};

	const handleReset = () => {
		onChange([min, max]);
	};

	const isFiltered = value[0] !== min || value[1] !== max;

	return (
		<div className={`space-y-4 ${className}`}>
			{label && (
				<div className="flex items-center justify-between">
					<Label className="text-sm font-medium">{label}</Label>
					{isFiltered && (
						<button
							onClick={handleReset}
							className="text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							Reset
						</button>
					)}
				</div>
			)}

			{/* Value Display */}
			<div className="flex items-center justify-between text-sm px-1">
				<span className="text-muted-foreground">
					Min: <span className="font-semibold text-foreground">{value[0]}</span>
				</span>
				<span className="text-muted-foreground">
					Max: <span className="font-semibold text-foreground">{value[1]}</span>
				</span>
			</div>

			{/* Slider */}
			<Slider
				min={min}
				max={max}
				step={step}
				value={value}
				onValueChange={handleValueChange}
				className="w-full"
			/>
		</div>
	);
}
