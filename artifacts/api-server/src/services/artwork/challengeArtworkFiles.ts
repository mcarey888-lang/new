/** Storage listings are unordered. Version 10 is newer than version 2; a
 * selected approval must never fall through to a different generated version. */
export function selectChallengeArtworkFile<T extends { name: string }>(
  files: T[], crop: string, approvedVersion?: number,
): T | undefined {
  return files.filter(file => {
    const match = file.name.match(/\/v(\d+)\/([^/]+)\.jpg$/);
    return match && match[2] === crop &&
      (approvedVersion === undefined || Number(match[1]) === approvedVersion);
  }).sort((a, b) => {
    const version = (name: string) => Number(name.match(/\/v(\d+)\//)?.[1] ?? 0);
    return version(b.name) - version(a.name);
  })[0];
}
