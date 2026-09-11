/** Skip HTTP rate limiters in Vitest and dedicated load-test processes. */
export function skipRateLimit(): boolean {
  return Boolean(process.env.VITEST) || process.env.LOAD_TESTING === "1";
}
