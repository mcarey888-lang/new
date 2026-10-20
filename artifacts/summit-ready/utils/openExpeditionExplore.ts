/**
 * The Expedition layout rejects navigation while Training is still selected.
 * Persist/swap the existing shell snapshots before opening its Explore page.
 * This does not create, clear or regenerate either shell's goal.
 */
export async function openExpeditionExplore(
  setShellMode: (mode: "expedition") => Promise<void>,
  navigate: () => void,
): Promise<void> {
  await setShellMode("expedition");
  navigate();
}
