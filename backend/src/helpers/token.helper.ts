const DURATION_PATTERN = /^(\d+)(s|m|h|d)$/;

export function durationToSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Unsupported duration format: ${value}`);
  }

  const amount = Number(match[1]);
  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  } as const;

  return amount * multipliers[match[2] as keyof typeof multipliers];
}
