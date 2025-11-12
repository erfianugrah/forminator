import { useEffect, useRef, useState } from 'react';

// Turnstile configuration
const TURNSTILE_SITEKEY = '0x4AAAAAACAjw0bmUZ7V7fh2';

// Turnstile API types
declare global {
	interface Window {
		turnstile?: {
			ready(callback: () => void): void;
			render(
				container: string | HTMLElement,
				options: {
					sitekey: string;
					theme?: 'light' | 'dark' | 'auto';
					size?: 'normal' | 'flexible' | 'compact';
					appearance?: 'always' | 'execute' | 'interaction-only';
					execution?: 'render' | 'execute';
					retry?: 'auto' | 'never';
					'refresh-expired'?: 'auto' | 'manual' | 'never';
					'response-field'?: boolean;
					action?: string;
					cData?: string;
					callback?: (token: string) => void;
					'error-callback'?: (error?: string) => void;
					'expired-callback'?: () => void;
					'timeout-callback'?: () => void;
					'before-interactive-callback'?: () => void;
					'after-interactive-callback'?: () => void;
					'unsupported-callback'?: () => void;
					language?: string;
					tabindex?: number;
				}
			): string;
			reset(widgetId: string): void;
			remove(widgetId: string): void;
			execute(widgetId: string | HTMLElement): void;
			getResponse(widgetId: string): string | undefined;
		};
	}
}

interface TurnstileWidgetProps {
	onValidated: (token: string) => void;
	onError?: (error?: string) => void;
	action?: string;
}

export default function TurnstileWidget({
	onValidated,
	onError,
	action = 'submit-form',
}: TurnstileWidgetProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Check if Turnstile script is loaded
		if (!window.turnstile) {
			setError('Turnstile script not loaded');
			setIsLoading(false);
			return;
		}

		// Get current theme
		const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

		// Render widget when ready
		window.turnstile.ready(() => {
			if (!containerRef.current || widgetIdRef.current) return;

			try {
				const widgetId = window.turnstile!.render(containerRef.current, {
					sitekey: TURNSTILE_SITEKEY,
					theme: 'auto', // Auto syncs with system preference
					size: 'flexible', // Responsive
					appearance: 'interaction-only', // Hidden until needed
					execution: 'execute', // Manual trigger
					retry: 'auto',
					'refresh-expired': 'auto',
					'response-field': false, // Manual token handling
					action,
					callback: (token) => {
						console.log('Turnstile validation successful');
						onValidated(token);
					},
					'error-callback': (err) => {
						console.error('Turnstile error:', err);
						setError('Verification failed. Please try again.');
						onError?.(err);
					},
					'expired-callback': () => {
						console.warn('Turnstile token expired');
						setError('Verification expired. Please try again.');
					},
					'timeout-callback': () => {
						console.warn('Turnstile timeout');
						setError('Verification timed out. Please try again.');
					},
					'unsupported-callback': () => {
						console.error('Turnstile not supported');
						setError('Your browser does not support verification.');
					},
					language: 'auto',
					tabindex: 0,
				});

				widgetIdRef.current = widgetId;
				setIsLoading(false);
				console.log('Turnstile widget rendered:', widgetId);
			} catch (err) {
				console.error('Error rendering Turnstile:', err);
				setError('Failed to load verification widget');
				setIsLoading(false);
			}
		});

		// Cleanup on unmount
		return () => {
			if (widgetIdRef.current && window.turnstile) {
				try {
					window.turnstile.remove(widgetIdRef.current);
					widgetIdRef.current = null;
				} catch (err) {
					console.error('Error removing Turnstile widget:', err);
				}
			}
		};
	}, [action, onValidated, onError]);

	// Expose execute method
	const execute = () => {
		if (widgetIdRef.current && window.turnstile) {
			window.turnstile.execute(widgetIdRef.current);
		}
	};

	// Expose reset method
	const reset = () => {
		if (widgetIdRef.current && window.turnstile) {
			window.turnstile.reset(widgetIdRef.current);
			setError(null);
		}
	};

	// Attach methods to ref for parent access
	useEffect(() => {
		if (containerRef.current) {
			(containerRef.current as any).execute = execute;
			(containerRef.current as any).reset = reset;
		}
	}, []);

	return (
		<div className="turnstile-container">
			<div ref={containerRef} />
			{isLoading && (
				<div className="text-sm text-muted-foreground">Loading verification...</div>
			)}
			{error && <div className="text-sm text-destructive mt-2">{error}</div>}
		</div>
	);
}
