import * as React from 'react';
import { cn } from '../../lib/utils';

interface DialogProps {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
}

export function Dialog({ open, onClose, children }: DialogProps) {
	React.useEffect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	}, [open]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={onClose}
			/>
			{/* Dialog */}
			<div className="relative z-50 w-full max-w-4xl max-h-[90vh] overflow-hidden">
				{children}
			</div>
		</div>
	);
}

export function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				'bg-background border rounded-lg shadow-lg overflow-y-auto max-h-[90vh]',
				className
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn('flex flex-col space-y-1.5 p-6 border-b', className)}
			{...props}
		/>
	);
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h2
			className={cn('text-lg font-semibold leading-none tracking-tight', className)}
			{...props}
		/>
	);
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn('text-sm text-muted-foreground', className)}
			{...props}
		/>
	);
}
