import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import TurnstileWidget from './TurnstileWidget';

interface FormData {
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	address: string;
	dateOfBirth: string;
}

interface FormErrors {
	[key: string]: string;
}

export default function SubmissionForm() {
	const [formData, setFormData] = useState<FormData>({
		firstName: '',
		lastName: '',
		email: '',
		phone: '',
		address: '',
		dateOfBirth: '',
	});

	const [errors, setErrors] = useState<FormErrors>({});
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitResult, setSubmitResult] = useState<{
		type: 'success' | 'error';
		message: string;
	} | null>(null);

	const turnstileRef = useRef<HTMLDivElement>(null);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
		// Clear error for this field
		if (errors[name]) {
			setErrors((prev) => {
				const newErrors = { ...prev };
				delete newErrors[name];
				return newErrors;
			});
		}
	};

	const validateForm = (): boolean => {
		const newErrors: FormErrors = {};

		if (!formData.firstName.trim()) {
			newErrors.firstName = 'First name is required';
		}

		if (!formData.lastName.trim()) {
			newErrors.lastName = 'Last name is required';
		}

		if (!formData.email.trim()) {
			newErrors.email = 'Email is required';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
			newErrors.email = 'Invalid email address';
		}

		if (!formData.phone.trim()) {
			newErrors.phone = 'Phone is required';
		}

		if (!formData.address.trim()) {
			newErrors.address = 'Address is required';
		}

		if (!formData.dateOfBirth) {
			newErrors.dateOfBirth = 'Date of birth is required';
		} else {
			const birthDate = new Date(formData.dateOfBirth);
			const today = new Date();
			const age = today.getFullYear() - birthDate.getFullYear();
			if (age < 18 || age > 120) {
				newErrors.dateOfBirth = 'You must be at least 18 years old';
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitResult(null);

		// Validate form
		if (!validateForm()) {
			return;
		}

		// Trigger Turnstile challenge
		if (!turnstileToken) {
			if (turnstileRef.current && (turnstileRef.current as any).execute) {
				(turnstileRef.current as any).execute();
			}
			return;
		}

		// Submit form
		setIsSubmitting(true);

		try {
			const response = await fetch('/api/submissions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					...formData,
					turnstileToken,
				}),
			});

			const result = await response.json();

			if (response.ok) {
				setSubmitResult({
					type: 'success',
					message: result.message || 'Form submitted successfully!',
				});
				// Reset form
				setFormData({
					firstName: '',
					lastName: '',
					email: '',
					phone: '',
					address: '',
					dateOfBirth: '',
				});
				setTurnstileToken(null);
				// Reset Turnstile
				if (turnstileRef.current && (turnstileRef.current as any).reset) {
					(turnstileRef.current as any).reset();
				}
			} else {
				setSubmitResult({
					type: 'error',
					message: result.message || 'Submission failed. Please try again.',
				});
				setTurnstileToken(null);
				// Reset Turnstile
				if (turnstileRef.current && (turnstileRef.current as any).reset) {
					(turnstileRef.current as any).reset();
				}
			}
		} catch (error) {
			console.error('Submission error:', error);
			setSubmitResult({
				type: 'error',
				message: 'An error occurred. Please try again.',
			});
			setTurnstileToken(null);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleTurnstileValidated = (token: string) => {
		console.log('Turnstile validated, token received');
		setTurnstileToken(token);
		// Automatically submit form after Turnstile validation
		setTimeout(() => {
			const form = document.getElementById('submission-form') as HTMLFormElement;
			if (form) {
				form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
			}
		}, 100);
	};

	const handleTurnstileError = (error?: string) => {
		console.error('Turnstile error:', error);
		setSubmitResult({
			type: 'error',
			message: 'Verification failed. Please try again.',
		});
	};

	return (
		<Card className="w-full max-w-2xl mx-auto">
			<CardHeader>
				<CardTitle>User Registration</CardTitle>
				<CardDescription>
					Complete the form below to submit your information
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form id="submission-form" onSubmit={handleSubmit} className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="firstName">First Name</Label>
							<Input
								id="firstName"
								name="firstName"
								value={formData.firstName}
								onChange={handleInputChange}
								placeholder="John"
								disabled={isSubmitting}
							/>
							{errors.firstName && (
								<p className="text-sm text-destructive">{errors.firstName}</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="lastName">Last Name</Label>
							<Input
								id="lastName"
								name="lastName"
								value={formData.lastName}
								onChange={handleInputChange}
								placeholder="Doe"
								disabled={isSubmitting}
							/>
							{errors.lastName && (
								<p className="text-sm text-destructive">{errors.lastName}</p>
							)}
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							name="email"
							type="email"
							value={formData.email}
							onChange={handleInputChange}
							placeholder="john.doe@example.com"
							disabled={isSubmitting}
						/>
						{errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
					</div>

					<div className="space-y-2">
						<Label htmlFor="phone">Phone</Label>
						<Input
							id="phone"
							name="phone"
							type="tel"
							value={formData.phone}
							onChange={handleInputChange}
							placeholder="+1234567890"
							disabled={isSubmitting}
						/>
						{errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
					</div>

					<div className="space-y-2">
						<Label htmlFor="address">Address</Label>
						<Input
							id="address"
							name="address"
							value={formData.address}
							onChange={handleInputChange}
							placeholder="123 Main St, City, State, ZIP"
							disabled={isSubmitting}
						/>
						{errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
					</div>

					<div className="space-y-2">
						<Label htmlFor="dateOfBirth">Date of Birth</Label>
						<Input
							id="dateOfBirth"
							name="dateOfBirth"
							type="date"
							value={formData.dateOfBirth}
							onChange={handleInputChange}
							disabled={isSubmitting}
						/>
						{errors.dateOfBirth && (
							<p className="text-sm text-destructive">{errors.dateOfBirth}</p>
						)}
					</div>

					<div className="space-y-2">
						<div ref={turnstileRef}>
							<TurnstileWidget
								onValidated={handleTurnstileValidated}
								onError={handleTurnstileError}
							/>
						</div>
					</div>

					{submitResult && (
						<Alert variant={submitResult.type === 'success' ? 'success' : 'destructive'}>
							<AlertTitle>
								{submitResult.type === 'success' ? 'Success!' : 'Error'}
							</AlertTitle>
							<AlertDescription>{submitResult.message}</AlertDescription>
						</Alert>
					)}

					<Button type="submit" className="w-full" disabled={isSubmitting}>
						{isSubmitting ? 'Submitting...' : 'Submit'}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
