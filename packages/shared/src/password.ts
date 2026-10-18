// Shared password validation rules
// Requirements: min 8 chars, at least 1 symbol, 1 capital, 1 number

export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Minimal ${PASSWORD_MIN_LENGTH} karakter`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Minimal 1 huruf kapital');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Minimal 1 angka');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Minimal 1 simbol');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export interface PasswordCheck {
  label: string;
  passed: boolean;
}

export function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    {
      label: `Minimal ${PASSWORD_MIN_LENGTH} karakter`,
      passed: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      label: 'Minimal 1 huruf kapital',
      passed: /[A-Z]/.test(password),
    },
    {
      label: 'Minimal 1 angka',
      passed: /[0-9]/.test(password),
    },
    {
      label: 'Minimal 1 simbol',
      passed: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    },
  ];
}
