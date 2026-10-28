import { tierForPackage } from "@workspace/membership";

/** Advertise only the actual eligible offer the SDK will purchase. */
export function verifiedTrialDays(
  platform: string,
  pkg: any,
  iosEligible = false,
): 14 | null {
  const offering = pkg?.presentedOfferingContext?.offeringIdentifier ?? pkg?.offeringIdentifier;
  if (tierForPackage(pkg?.identifier ?? "", offering) !== "pro") return null;
  if (platform === "ios" && iosEligible) {
    const intro = pkg?.product?.introPrice;
    if (intro?.price !== 0 || intro?.cycles !== 1) return null;
    const days = intro.periodUnit === "DAY" ? intro.periodNumberOfUnits
      : intro.periodUnit === "WEEK" ? intro.periodNumberOfUnits * 7 : null;
    return days === 14 ? 14 : null;
  }
  if (platform === "android") {
    const period = pkg?.product?.defaultOption?.freePhase?.billingPeriod?.iso8601;
    return period === "P2W" || period === "P14D" ? 14 : null;
  }
  return null;
}
