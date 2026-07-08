/**
 * Wraps a promise so it always settles within `ms` milliseconds.
 *
 * Clerk's Frontend API calls have no built-in timeout. On a slow, blocked, or
 * otherwise degraded network (e.g. Apple App Review's environment) an awaited
 * call can hang forever, leaving a button's loading state stuck and its
 * ActivityIndicator spinning indefinitely. Every Clerk auth call must be
 * wrapped with this so the UI always recovers into an error state instead.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = "This is taking longer than expected — please check your connection and try again.",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}
