/**
 * Returns the current local calendar date as YYYY-MM-DD.
 * Uses `en-CA` locale (ISO date order) with local time — avoids the UTC
 * offset bug where `toISOString()` can return the previous day for UTC+2/+3
 * users working past midnight local time.
 */
export function localISODate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA");
}
