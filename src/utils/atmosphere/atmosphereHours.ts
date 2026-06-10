/** Game-hour indices 0–23 used across atmosphere/weather editors and previews. */
export const ATMOSPHERE_HOURS: number[] = Array.from({ length: 24 }, (_, index) => index);

/** Step preview hour by delta with wrap-around at 24h. */
export function stepAtmosphereHour(hour: number, delta: number): number {
  return (hour + delta + 24) % 24;
}
