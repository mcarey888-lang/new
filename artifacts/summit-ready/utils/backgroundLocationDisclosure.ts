/**
 * The disclosure Google Play requires before asking for background location.
 *
 * Play's Location Permissions policy does not accept the system dialog on its
 * own. Before that dialog appears, the app has to show its own screen that
 * names the data, says it is collected in the background — including when the
 * app is closed — gives the reason, and waits for the person to agree. Apps
 * that go straight to the system prompt get the build rejected, and live ones
 * get pulled.
 *
 * Written as injected dependencies so the order can be tested: the value of
 * this is entirely in what happens before what.
 */

export const BACKGROUND_LOCATION_TITLE = "Keep recording with the screen off";

export const BACKGROUND_LOCATION_MESSAGE =
  "To record your full route, SummitReady collects your location in the " +
  "background — while the app is closed, and while your phone is locked or " +
  "in your pocket.\n\n" +
  "It is used to measure your distance, ascent and the shape of your track, " +
  "and it is collected only while a hike is running. Stopping the hike stops " +
  "the collection.\n\n" +
  "You can say no and still record, but the track may stop when your screen " +
  "locks.";

export const BACKGROUND_LOCATION_AGREE = "Continue";
export const BACKGROUND_LOCATION_DECLINE = "Not now";

export type PermissionOutcome = { status: string } | null;

export interface DisclosureDeps {
  /** Shows the disclosure; resolves true only on the affirmative choice. */
  confirm(input: {
    title: string; message: string; agreeLabel: string; declineLabel: string;
  }): Promise<boolean>;
  /** The system permission prompt. */
  request(): Promise<PermissionOutcome>;
}

export interface BackgroundLocationResult {
  granted: boolean;
  /** True when the person declined the disclosure, so no system prompt ran. */
  declinedDisclosure: boolean;
}

/**
 * Ask for background location, disclosure first.
 *
 * Declining means the system prompt is never shown — which is the point. A
 * disclosure that is shown but ignored is the same policy breach as no
 * disclosure, and it also burns the one chance Android gives to ask.
 */
export async function requestBackgroundLocation(
  deps: DisclosureDeps,
): Promise<BackgroundLocationResult> {
  const agreed = await deps.confirm({
    title: BACKGROUND_LOCATION_TITLE,
    message: BACKGROUND_LOCATION_MESSAGE,
    agreeLabel: BACKGROUND_LOCATION_AGREE,
    declineLabel: BACKGROUND_LOCATION_DECLINE,
  });
  if (!agreed) return { granted: false, declinedDisclosure: true };

  const result = await deps.request().catch(() => null);
  return { granted: result?.status === "granted", declinedDisclosure: false };
}
