/**
 * Explore is shared by both shells. Persist/swap the existing shell snapshots
 * before opening it, so it keeps Expedition mode rather than Training mode.
 * This does not create, clear or regenerate either shell's goal.
 */
export async function openExpeditionExplore(
  setShellMode: (mode: "expedition") => Promise<void>,
  navigate: () => void,
): Promise<void> {
  await setShellMode("expedition");
  navigate();
}
