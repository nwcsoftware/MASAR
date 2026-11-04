/** Flag licences expiring within `days` (FR-04 licence expiry). */
export function licenceExpiresSoon(expiry: string | null, days = 60, now: Date = new Date()): boolean {
  if (!expiry) return false;
  return new Date(`${expiry}T00:00:00Z`).getTime() - now.getTime() < days * 86_400_000;
}
