import { cn } from '../lib/utils';

export type FlowStep =
  | 'idle'
  | 'validating'
  | 'turnstile-challenge'
  | 'turnstile-interactive'
  | 'turnstile-success'
  | 'server-validation'
  | 'fraud-check'
  | 'success'
  | 'error';

interface SubmissionFlowProps {
  currentStep: FlowStep;
  errorMessage?: string;
}

export function SubmissionFlow({ currentStep, errorMessage }: SubmissionFlowProps) {
  const steps = [
    {
      id: 'validating' as const,
      title: 'Form Validation',
      description: 'Checking your input',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: 'turnstile-challenge' as const,
      title: 'Turnstile Verification',
      description: 'Running security challenge',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
    {
      id: 'server-validation' as const,
      title: 'Server Validation',
      description: 'Validating token & checking fraud patterns',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
          />
        </svg>
      ),
    },
    {
      id: 'success' as const,
      title: 'Complete',
      description: 'Submission successful!',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ),
    },
  ];

  const getStepStatus = (stepId: FlowStep) => {
    if (currentStep === 'error') {
      return 'error';
    }

    if (currentStep === 'idle') {
      return 'pending';
    }

    const stepOrder: FlowStep[] = [
      'validating',
      'turnstile-challenge',
      'turnstile-interactive',
      'turnstile-success',
      'server-validation',
      'fraud-check',
      'success',
    ];

    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(stepId);

    if (stepId === 'turnstile-challenge') {
      // Turnstile step is active during multiple phases
      if (
        ['turnstile-challenge', 'turnstile-interactive', 'turnstile-success'].includes(currentStep)
      ) {
        return 'active';
      }
      if (currentIndex > 2) {
        return 'complete';
      }
    }

    if (stepId === 'server-validation') {
      // Server validation combines multiple backend steps
      if (['server-validation', 'fraud-check'].includes(currentStep)) {
        return 'active';
      }
      if (currentStep === 'success') {
        return 'complete';
      }
    }

    if (currentIndex > stepIndex) {
      return 'complete';
    }

    if (currentIndex === stepIndex) {
      return 'active';
    }

    return 'pending';
  };

  if (currentStep === 'idle') {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative px-4">
        {/* Progress bar background */}
        <div className="absolute top-6 left-8 right-8 h-1 bg-border rounded-full" />

        {steps.map((step, index) => {
          const status = getStepStatus(step.id);

          return (
            <div key={step.id} className="flex flex-col items-center relative z-10" style={{ flex: 1 }}>
              {/* Step circle */}
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-500',
                  status === 'complete' &&
                    'bg-primary text-primary-foreground shadow-lg',
                  status === 'active' &&
                    'bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20',
                  status === 'pending' && 'bg-muted text-muted-foreground',
                  status === 'error' && 'bg-destructive text-destructive-foreground shadow-lg'
                )}
              >
                {status === 'complete' ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : status === 'active' ? (
                  <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                ) : status === 'error' ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <div className="w-3 h-3 bg-current rounded-full opacity-50" />
                )}
              </div>

              {/* Step text */}
              <div className="text-center max-w-[120px]">
                <p
                  className={cn(
                    'text-xs font-semibold mb-0.5 transition-colors duration-300',
                    status === 'active' && 'text-primary',
                    status === 'complete' && 'text-foreground',
                    status === 'pending' && 'text-muted-foreground',
                    status === 'error' && 'text-destructive'
                  )}
                >
                  {step.title}
                </p>
                <p
                  className={cn(
                    'text-xs transition-all duration-300',
                    status === 'active' ? 'text-muted-foreground opacity-100 max-h-20' : 'opacity-0 max-h-0'
                  )}
                >
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error message */}
      {currentStep === 'error' && errorMessage && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/50 rounded-lg">
          <p className="text-sm text-destructive text-center">{errorMessage}</p>
        </div>
      )}

      {/* Active step details */}
      {currentStep === 'turnstile-interactive' && (
        <div className="mt-4 p-3 bg-accent/10 border border-accent/50 rounded-lg">
          <p className="text-sm text-center text-muted-foreground">
            Additional verification required. Please complete the interactive challenge.
          </p>
        </div>
      )}
    </div>
  );
}
