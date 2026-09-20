export type ElevationBankCreditIdentity = {
  activityId: string;
  sourceId: string;
};

export function findElevationBankCreditForActivity<T extends ElevationBankCreditIdentity>(
  credits: readonly T[],
  activityOrSourceId: string,
): T | undefined {
  return credits.find((credit) =>
    credit.activityId === activityOrSourceId || credit.sourceId === activityOrSourceId);
}