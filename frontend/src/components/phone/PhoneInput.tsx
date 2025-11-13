import * as React from 'react';
import { cn } from '../../lib/utils';
import { CountrySelect } from './CountrySelect';
import { getCountryByCode, getCountryByDialCode } from './countries';

interface PhoneInputProps {
  value: string; // Full phone number with dial code (e.g., '+15551234567')
  onChange: (phone: string) => void;
  defaultCountry?: string; // ISO code from geolocation
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry = 'us',
  disabled,
  error,
  placeholder = 'Phone number',
}: PhoneInputProps) {
  // Parse country and number from value
  const [country, setCountry] = React.useState(defaultCountry);
  const [dialCode, setDialCode] = React.useState('+1');

  // Initialize country and dial code from value or default
  React.useEffect(() => {
    if (value && value.startsWith('+')) {
      // Try to parse dial code from value
      for (let i = 2; i <= 4; i++) {
        const potentialDialCode = value.substring(0, i);
        const foundCountry = getCountryByDialCode(potentialDialCode);
        if (foundCountry) {
          setCountry(foundCountry.code);
          setDialCode(foundCountry.dial);
          return;
        }
      }
    } else if (defaultCountry) {
      const defaultCountryData = getCountryByCode(defaultCountry);
      if (defaultCountryData) {
        setCountry(defaultCountryData.code);
        setDialCode(defaultCountryData.dial);
      }
    }
  }, [defaultCountry]);

  // Get the number part (without dial code)
  const getNumberPart = (fullNumber: string): string => {
    if (!fullNumber || !fullNumber.startsWith('+')) return '';
    return fullNumber.substring(dialCode.length);
  };

  const handleCountryChange = (newCountryCode: string, newDialCode: string) => {
    setCountry(newCountryCode);
    setDialCode(newDialCode);

    // Keep the existing number digits, just change the dial code
    const numberPart = getNumberPart(value);
    onChange(newDialCode + numberPart);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Remove all non-digit characters
    const digitsOnly = input.replace(/\D/g, '');
    // Combine with dial code
    onChange(dialCode + digitsOnly);
  };

  const numberValue = getNumberPart(value);

  return (
    <div className="flex w-full">
      <CountrySelect
        value={country}
        onChange={handleCountryChange}
        disabled={disabled}
      />
      <input
        type="tel"
        value={numberValue}
        onChange={handleNumberChange}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          'flex h-11 w-full rounded-r-md border border-l-0 border-input bg-background px-3 py-2 text-sm',
          'transition-all duration-150',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary',
          'hover:border-primary/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive focus-visible:ring-destructive'
        )}
      />
    </div>
  );
}
