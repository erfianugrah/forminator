/**
 * SQLite datetime utilities
 *
 * SQLite stores DATETIME as "YYYY-MM-DD HH:MM:SS" (space separator)
 * JavaScript Date.toISOString() returns "YYYY-MM-DDTHH:MM:SS.sssZ" (T separator)
 * Direct comparison fails because space < T in ASCII, causing time-based queries to fail
 */

/**
 * Convert JavaScript Date to SQLite-compatible datetime string
 * @param date - JavaScript Date object
 * @returns SQLite datetime string in format "YYYY-MM-DD HH:MM:SS"
 */
export function toSQLiteDateTime(date: Date): string {
	return date
		.toISOString()
		.replace('T', ' ')
		.replace(/\.\d{3}Z$/, '');
}
