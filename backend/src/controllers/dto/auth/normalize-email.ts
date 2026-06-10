import type { TransformFnParams } from 'class-transformer';

export function normalizeEmail({
  value: rawValue,
}: TransformFnParams): unknown {
  const value: unknown = rawValue;
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
