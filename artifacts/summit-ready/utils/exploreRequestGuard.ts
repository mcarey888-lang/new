/** Version guard for suppressing AI responses invalidated by newer searches. */
export function createExploreAiRequestGuard() {
  let currentVersion = 0;
  return {
    begin(): number {
      currentVersion += 1;
      return currentVersion;
    },
    invalidate(): void {
      currentVersion += 1;
    },
    isCurrent(version: number): boolean {
      return version === currentVersion;
    },
  };
}