import { z } from 'zod';

// Form submission schema (matches worker/src/lib/validation.ts)
export const formSubmissionSchema = z.object({
	firstName: z
		.string()
		.min(1, 'First name is required')
		.max(50, 'First name must be less than 50 characters')
		.regex(/^[a-zA-Z\s'-]+$/, 'First name contains invalid characters'),
	lastName: z
		.string()
		.min(1, 'Last name is required')
		.max(50, 'Last name must be less than 50 characters')
		.regex(/^[a-zA-Z\s'-]+$/, 'Last name contains invalid characters'),
	email: z
		.string()
		.min(1, 'Email is required')
		.email('Invalid email address')
		.max(100, 'Email must be less than 100 characters'),
	phone: z
		.string()
		.min(1, 'Phone is required')
		.regex(
			/^\+?[1-9]\d{1,14}$/,
			'Phone must be in E.164 format (e.g., +12345678900)'
		),
	address: z
		.string()
		.min(1, 'Address is required')
		.max(200, 'Address must be less than 200 characters'),
	dateOfBirth: z
		.string()
		.min(1, 'Date of birth is required')
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
		.refine((date) => {
			const birthDate = new Date(date);
			const today = new Date();
			const age = today.getFullYear() - birthDate.getFullYear();
			return age >= 18 && age <= 120;
		}, 'You must be at least 18 years old'),
	turnstileToken: z.string().min(1, 'Turnstile token is required'),
});

export type FormSubmissionInput = z.infer<typeof formSubmissionSchema>;
