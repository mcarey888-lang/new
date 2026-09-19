import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  assertStage2LedgerWritesAvailable,
} from "../services/stage2Ledgers";
import {
  getElevationBankSummary,
  getRecentElevationBankCredits,
} from "../services/elevationBank";

const router: IRouter = Router();

type ElevationSummary = Awaited<ReturnType<typeof getElevationBankSummary>>;
export type ElevationBankCreditRow = Awaited<
  ReturnType<typeof getRecentElevationBankCredits>
>[number];

export function serializeElevationBankResponse(
  summary: ElevationSummary,
  recent: readonly ElevationBankCreditRow[],
) {
  return {
    status: "available" as const,
    lifetimeAscentM: summary.lifetimeAscentM,
    periodAscentM: summary.periodAscentM,
    creditedActivities: summary.creditedActivities,
    everestEquivalent: summary.everestEquivalent,
    recentCredits: recent.map((credit) => ({
      activityId: credit.activityId,
      revision: credit.revision,
      status: credit.status,
      creditedAscentM: credit.creditedAscentM,
      evidenceClass: credit.evidenceClass,
      ruleVersion: credit.ruleVersion,
      effectiveAt: credit.effectiveAt.toISOString(),
    })),
  };
}

function currentMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type ElevationBankRouteDependencies = {
  assertAvailable: () => void;
  getSummary: typeof getElevationBankSummary;
  getRecent: typeof getRecentElevationBankCredits;
};

export function createElevationBankHandler(
  dependencies: ElevationBankRouteDependencies = {
    assertAvailable: assertStage2LedgerWritesAvailable,
    getSummary: getElevationBankSummary,
    getRecent: getRecentElevationBankCredits,
  },
): RequestHandler {
  return async (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    try {
      // Keep the dependency gate at the read boundary too: an unavailable
      // development ledger must never be represented as a zero total.
      dependencies.assertAvailable();
      const summary = await dependencies.getSummary(userId, {
        from: currentMonthStart(),
      });
      const recent = await dependencies.getRecent(userId, 12);

      return res.json(serializeElevationBankResponse(summary, recent));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        message.includes("disabled in production")
        || message.includes("availability gate is disabled")
      ) {
        return res.status(503).json({
          status: "unavailable",
          reason: "development_dependency_unavailable",
        });
      }
      req.log.error({ err: error, userId }, "Elevation Bank read failed");
      return res.status(500).json({
        status: "unavailable",
        reason: "load_failed",
      });
    }
  };
}

router.get("/elevation-bank", createElevationBankHandler());

export default router;