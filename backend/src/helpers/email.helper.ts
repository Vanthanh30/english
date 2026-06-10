export function verificationUrl(origin: string, token: string): string {
  return `${origin}/verify-email?token=${encodeURIComponent(token)}`;
}
