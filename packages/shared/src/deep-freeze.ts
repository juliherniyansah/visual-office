// Recursively freezes plain objects/arrays so shared constants cannot be mutated at runtime.
export function deepFreeze<T extends object>(value: T): T {
  const children: unknown[] = Object.values(value);
  for (const child of children) {
    if (typeof child === 'object' && child !== null) {
      deepFreeze(child);
    }
  }
  Object.freeze(value);
  return value;
}
