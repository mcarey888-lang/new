/**
 * What to say when sign-in cannot run because the auth service is not ready.
 *
 * The screens used to say "Authentication service is still loading — please
 * wait a moment and try again." for every such case. That sentence is only
 * true for the first second or two after launch. With no signal the service
 * never loads, so the message told people that waiting would fix it when
 * nothing would, offered no idea what was actually wrong, and never changed
 * however long they waited. On a hill-walking app, where being out of signal
 * is normal rather than exceptional, that is the common case and not the
 * edge one.
 *
 * There is no network probe here on purpose. Adding one to the sign-in screen
 * is another thing to be slow, another thing to fail, and it would still only
 * guess. The honest evidence is how long we have been waiting, so that is
 * what decides which of the two true things to say.
 */

/**
 * How long a genuinely slow load gets before "still loading" stops being a
 * fair description. Clerk settles in well under a second on a working
 * connection; five is generous enough that a slow train still reads as slow
 * rather than broken.
 */
export const AUTH_SLOW_MS = 5_000;

export const AUTH_CONNECTING_MESSAGE =
  "Still connecting to the sign-in service. Try again in a moment.";

export const AUTH_UNREACHABLE_MESSAGE =
  "Can't reach the sign-in service. Check your connection and try again.";

/**
 * `msWaiting` is the time since the screen opened, not since the tap. A
 * non-finite or negative value is treated as no time passed, because the one
 * thing worse than the old message is one that calls a working connection
 * broken.
 */
export function authUnavailableMessage(msWaiting: number): string {
  if (!Number.isFinite(msWaiting) || msWaiting < AUTH_SLOW_MS) {
    return AUTH_CONNECTING_MESSAGE;
  }
  return AUTH_UNREACHABLE_MESSAGE;
}
