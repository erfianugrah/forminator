// Cloudflare Request types based on Workers documentation
// See: https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties

export interface IncomingRequestCfProperties {
	// Geographic data
	city?: string;
	continent?: string;
	country?: string;
	latitude?: string;
	longitude?: string;
	postalCode?: string;
	region?: string;
	regionCode?: string;
	timezone?: string;

	// Network data
	asn?: number;
	asOrganization?: string;
	colo?: string;

	// TLS/HTTP data
	httpProtocol?: string;
	tlsVersion?: string;
	tlsCipher?: string;
	tlsClientAuth?: {
		certPresented?: string;
		certVerified?: string;
		certRevoked?: string;
	};

	// Bot Management
	botManagement?: {
		score?: number; // 1-99
		verifiedBot?: boolean;
		jsDetection?: {
			passed: boolean;
		};
		detectionIds?: number[];
		ja3Hash?: string;
		ja4?: string;
		ja4Signals?: {
			h2h3_ratio_1h?: number;
			heuristic_ratio_1h?: number;
			reqs_quantile_1h?: number;
			uas_rank_1h?: number;
			browser_ratio_1h?: number;
			paths_rank_1h?: number;
			reqs_rank_1h?: number;
			cache_ratio_1h?: number;
			ips_rank_1h?: number;
			ips_quantile_1h?: number;
		};
		staticResource?: boolean;
		corporateProxy?: boolean;
	};

	// Trust score
	clientTrustScore?: number; // 0-100

	// EU country flag
	isEUCountry?: string; // "0" or "1"
}

// Extended Request type with cf property
export interface CloudflareRequest extends Request {
	cf?: IncomingRequestCfProperties;
}

// Extracted metadata from request
export interface RequestMetadata {
	// Basic
	remoteIp: string;
	userAgent: string;

	// Geographic
	country?: string;
	region?: string;
	city?: string;
	postalCode?: string;
	timezone?: string;
	latitude?: string;
	longitude?: string;
	continent?: string;
	isEuCountry?: string;

	// Network
	asn?: number;
	asOrganization?: string;
	colo?: string;
	httpProtocol?: string;
	tlsVersion?: string;
	tlsCipher?: string;

	// Bot detection
	botScore?: number;
	clientTrustScore?: number;
	verifiedBot?: boolean;
	jsDetectionPassed?: boolean;
	detectionIds?: number[];

	// Fingerprints
	ja3Hash?: string;
	ja4?: string;
	ja4Signals?: Record<string, number>;
}

// Helper function to extract metadata from Request
export function extractRequestMetadata(request: CloudflareRequest): RequestMetadata {
	const headers = request.headers;
	const cf = request.cf;

	// Get IP from cf-connecting-ip header (most reliable) or fallback to CF property
	const remoteIp = headers.get('cf-connecting-ip') ||
	                 headers.get('x-real-ip') ||
	                 headers.get('x-forwarded-for')?.split(',')[0] ||
	                 '0.0.0.0';

	const userAgent = headers.get('user-agent') || 'unknown';

	return {
		// Basic
		remoteIp,
		userAgent,

		// Geographic (prefer request.cf over headers)
		country: cf?.country || headers.get('cf-ipcountry') || undefined,
		region: cf?.region || headers.get('cf-region') || undefined,
		city: cf?.city || headers.get('cf-ipcity') || undefined,
		postalCode: cf?.postalCode || headers.get('cf-postal-code') || undefined,
		timezone: cf?.timezone || headers.get('cf-timezone') || undefined,
		latitude: cf?.latitude || headers.get('cf-iplatitude') || undefined,
		longitude: cf?.longitude || headers.get('cf-iplongitude') || undefined,
		continent: cf?.continent || headers.get('cf-ipcontinent') || undefined,
		isEuCountry: cf?.isEUCountry,

		// Network
		asn: cf?.asn,
		asOrganization: cf?.asOrganization,
		colo: cf?.colo,
		httpProtocol: cf?.httpProtocol,
		tlsVersion: cf?.tlsVersion,
		tlsCipher: cf?.tlsCipher,

		// Bot detection (prefer cf.botManagement over headers)
		botScore: cf?.botManagement?.score ||
		         (headers.get('cf-bot-score') ? parseInt(headers.get('cf-bot-score')!, 10) : undefined),
		clientTrustScore: cf?.clientTrustScore,
		verifiedBot: cf?.botManagement?.verifiedBot || headers.get('cf-verified-bot') === 'true',
		jsDetectionPassed: cf?.botManagement?.jsDetection?.passed,
		detectionIds: cf?.botManagement?.detectionIds,

		// Fingerprints (prefer cf.botManagement over headers)
		ja3Hash: cf?.botManagement?.ja3Hash || headers.get('cf-ja3-hash') || undefined,
		ja4: cf?.botManagement?.ja4 || headers.get('cf-ja4') || undefined,
		ja4Signals: cf?.botManagement?.ja4Signals,
	};
}

// Form submission data
export interface FormSubmission {
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	address: string;
	dateOfBirth: string;
}

// Turnstile validation result
export interface TurnstileValidationResult {
	valid: boolean;
	reason?: string;
	data?: {
		success: boolean;
		challenge_ts?: string;
		hostname?: string;
		action?: string;
		cdata?: string;
		metadata?: {
			ephemeral_id?: string;
		};
	};
	errors?: string[];
	ephemeralId?: string | null;
	// Enhanced error reporting
	userMessage?: string; // User-friendly error message for display
	debugInfo?: {
		codes: string[];
		messages: string[];
		actions: string[];
		categories: string[];
	};
}

// Fraud check result
export interface FraudCheckResult {
	allowed: boolean;
	reason?: string;
	riskScore: number;
	warnings: string[];
}

// Environment bindings
export interface Env {
	// Secrets (note: use bracket notation to access)
	'TURNSTILE-SECRET-KEY': string;
	'TURNSTILE-SITE-KEY': string;
	'X-API-KEY'?: string;

	// Bindings
	DB: D1Database;
	ASSETS: Fetcher;

	// Variables
	ENVIRONMENT?: string;
}
