/**
 * Time formatting utilities for analytics dashboard
 */

/**
 * Convert ISO timestamp to relative time from now
 * @param isoTimestamp ISO 8601 timestamp string
 * @returns Human-readable relative time (e.g., "2h 30m", "45m", "23h 15m")
 */
export function getRelativeTime(isoTimestamp: string): string {
	const targetTime = new Date(isoTimestamp).getTime();
	const now = Date.now();
	const diffMs = targetTime - now;

	// If expired (past time)
	if (diffMs <= 0) {
		return 'Expired';
	}

	const totalMinutes = Math.floor(diffMs / (1000 * 60));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (hours === 0) {
		return `${minutes}m`;
	}

	if (minutes === 0) {
		return `${hours}h`;
	}

	return `${hours}h ${minutes}m`;
}

/**
 * Get time urgency level based on remaining time
 * Used for color coding
 * @param isoTimestamp ISO 8601 timestamp string
 * @returns 'critical' (<1h), 'warning' (<6h), 'normal' (>=6h), or 'expired'
 */
export function getTimeUrgency(
	isoTimestamp: string
): 'critical' | 'warning' | 'normal' | 'expired' {
	const targetTime = new Date(isoTimestamp).getTime();
	const now = Date.now();
	const diffMs = targetTime - now;

	if (diffMs <= 0) {
		return 'expired';
	}

	const hours = diffMs / (1000 * 60 * 60);

	if (hours < 1) {
		return 'critical';
	}

	if (hours < 6) {
		return 'warning';
	}

	return 'normal';
}

/**
 * Get Tailwind CSS classes for time urgency
 * @param urgency Time urgency level
 * @returns Tailwind CSS classes for text and background colors
 */
export function getUrgencyClasses(urgency: 'critical' | 'warning' | 'normal' | 'expired'): {
	text: string;
	bg: string;
	border: string;
} {
	switch (urgency) {
		case 'critical':
			return {
				text: 'text-red-700 dark:text-red-400',
				bg: 'bg-red-50 dark:bg-red-950',
				border: 'border-red-200 dark:border-red-800',
			};
		case 'warning':
			return {
				text: 'text-yellow-700 dark:text-yellow-400',
				bg: 'bg-yellow-50 dark:bg-yellow-950',
				border: 'border-yellow-200 dark:border-yellow-800',
			};
		case 'normal':
			return {
				text: 'text-green-700 dark:text-green-400',
				bg: 'bg-green-50 dark:bg-green-950',
				border: 'border-green-200 dark:border-green-800',
			};
		case 'expired':
			return {
				text: 'text-gray-500 dark:text-gray-500',
				bg: 'bg-gray-50 dark:bg-gray-900',
				border: 'border-gray-200 dark:border-gray-800',
			};
	}
}

/**
 * Format timestamp for display (e.g., "2 hours ago", "just now")
 * @param isoTimestamp ISO 8601 timestamp string
 * @returns Human-readable past time
 */
export function getTimeAgo(isoTimestamp: string): string {
	const targetTime = new Date(isoTimestamp).getTime();
	const now = Date.now();
	const diffMs = now - targetTime;

	if (diffMs < 0) {
		return 'just now';
	}

	const seconds = Math.floor(diffMs / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (seconds < 60) {
		return 'just now';
	}

	if (minutes < 60) {
		return `${minutes}m ago`;
	}

	if (hours < 24) {
		return `${hours}h ago`;
	}

	if (days === 1) {
		return 'yesterday';
	}

	return `${days}d ago`;
}
