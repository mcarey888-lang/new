import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  assertStage2LedgerWritesAvailable,
} from "../services/stage2Ledgers";
import {
  getElevationBankSummary,
  getRecentElevationBankCredits,
  getRecentElevationBankEvents,
} from "../services/elevationBank";

const router: IRouter = Router();

type ElevationSummary = Awaited<ReturnType<typeof getElevationBankSummary>>;
export type ElevationBankCreditRow = Awaited<
  ReturnType<typeof getRecentElevationBankCredits>
>[number];
export type ElevationBankEventRow = Awaited<
  ReturnType<typeof getRecentElevationBankEvents>
>[number];

export function serializeElevationBankResponse(
  summary: ElevationSummary,
  recent: readonly ElevationBankCreditRow[],
  events: readonly ElevationBankEventRow[] = recent,
) {
  return {
    status: "available" as const,
    lifetimeAscentM: summary.lifetimeAscentM,
    periodAscentM: summary.periodAscentM,
    creditedActivities: summary.creditedActivities,
    everestEquivalent: summary.everestEquivalent,
    recentCredits: recent.map((credit) => ({
      activityId: credit.activityId,
      sourceId: credit.sourceId,
      sourceType: credit.sourceType,
      revision: credit.revision,
      status: credit.status,
      creditedAscentM: credit.creditedAscentM,
      evidenceClass: credit.evidenceClass,
      ruleVersion: credit.ruleVersion,
      effectiveAt: credit.effectiveAt.toISOString(),
    })),
    recentEvents: events.map((event) => ({
      activityId: event.activityId,
      sourceId: event.sourceId,
      sourceType: event.sourceType,
      revision: event.revision,
      status: event.status === "revoked" ? "revoked" as const : event.status,
      creditedAscentM: event.creditedAscentM,
      evidenceClass: event.evidenceClass,
      ruleVersion: event.ruleVersion,
      effectiveAt: event.effectiveAt.toISOString(),
      eventAt: event.createdAt.toISOString(),
    })),
  };
}

function currentMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type ElevationBankRouteDependencies = {
  assertAvailable: typeof assertStage2LedgerWritesAvailable;
  getSummary: typeof getElevationBankSummary;
  getRecent: typeof getRecentElevationBankCredits;
  getRecentEvents: typeof getRecentElevationBankEvents;
};

export function createElevationBankHandler(
  dependencies: ElevationBankRouteDependencies = {
    assertAvailable: assertStage2LedgerWritesAvailable,
    getSummary: getElevationBankSummary,
    getRecent: getRecentElevationBankCredits,
    getRecentEvents: getRecentElevationBankEvents,
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
      const [recent, events] = await Promise.all([
        dependencies.getRecent(userId, 12),
        dependencies.getRecentEvents(userId),
      ]);

      return res.json(serializeElevationBankResponse(summary, recent, events));
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