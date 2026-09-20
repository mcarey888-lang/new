import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useGetElevationBank } from "@workspace/api-client-react";
import { STAGE_8_ACHIEVEMENTS, STAGE_8_CHALLENGES } from "@/utils/challengeCatalogue";
import { evaluateAchievement, evaluateChallenge, evidenceLineageId } from "@/utils/challengeEvaluator";
import { createChallengeProjection, reduceChallengeProjection, type ChallengeProjection } from "@/utils/challengeProjection";
import type { EvidenceReference, ResolvedChallengeWindow } from "@/utils/challengeDomain";
import { deriveStage8Consequence } from "@/utils/stage8Consequence";
import { resolveCalendarMonthForInstant } from "@/utils/challengeEvaluator";
import { mapElevationBankEventToEvidence } from "@/utils/elevationBankEvidence";
import { compareEvidenceAuthority } from "@/utils/evidenceAuthority";

export type Stage8ConsequenceResult = {
  evidenceId: string;
  status: "confirmed" | "pending" | "unavailable" | "not_linked";
  challengeTitles: readonly string[];
  achievementTitles: readonly string[];
};

type PersistedStage8 = {
  projection?: ChallengeProjection;
  evidence?: EvidenceReference[];
  lastConsequences?: Record<string, Stage8ConsequenceResult>;
  windows?: Record<string, ResolvedChallengeWindow>;
};

type Stage8State = {
  catalogue: typeof STAGE_8_CHALLENGES;
  achievements: typeof STAGE_8_ACHIEVEMENTS;
  projection: ChallengeProjection;
  pendingEvidence: readonly EvidenceReference[];
  lastConsequence: Stage8ConsequenceResult | null;
  ingestEvidence: (
    evidence: EvidenceReference,
    windows?: Readonly<Record<string, ResolvedChallengeWindow>>,
  ) => Promise<Stage8ConsequenceResult>;
};

const emptyProjection = createChallengeProjection("");
const emptyResult = (evidenceId: string): Stage8ConsequenceResult => ({
  evidenceId, status: "not_linked", challengeTitles: [], achievementTitles: [],
});
const Stage8Context = createContext<Stage8State>({
  catalogue: STAGE_8_CHALLENGES,
  achievements: STAGE_8_ACHIEVEMENTS,
  projection: emptyProjection,
  pendingEvidence: [],
  lastConsequence: null,
  ingestEvidence: async (evidence) => emptyResult(evidence.evidenceId),
});

export function Stage8Provider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const elevationBankQuery = useGetElevationBank({
    query: { enabled: Boolean(userId), staleTime: 15_000, retry: 3, queryKey: ["/api/elevation-bank"] },
  });
  const key = userId ? `summitready_stage8_projection_${userId}` : null;
  const [projection, setProjection] = useState<ChallengeProjection>(emptyProjection);
  const [evidence, setEvidence] = useState<EvidenceReference[]>([]);
  const [lastConsequence, setLastConsequence] = useState<Stage8ConsequenceResult | null>(null);
  const projectionRef = useRef(emptyProjection);
  const evidenceRef = useRef<EvidenceReference[]>([]);
  const lastConsequencesRef = useRef<Record<string, Stage8ConsequenceResult>>({});
  const queueRef = useRef(Promise.resolve());
  const hydrationRef = useRef<Promise<void>>(Promise.resolve());
  const generationRef = useRef(0);
  const dirtyRef = useRef(false);
  const windowsRef = useRef<Record<string, ResolvedChallengeWindow>>({});
  const ownerRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  ownerRef.current = userId ?? null;

  useEffect(() => {
    let live = true;
    const generation = ++generationRef.current;
    const initial = userId ? createChallengeProjection(userId) : emptyProjection;
    projectionRef.current = initial;
    evidenceRef.current = [];
    lastConsequencesRef.current = {};
    windowsRef.current = {};
    setProjection(initial);
    setEvidence([]);
    setLastConsequence(null);
    if (!key) return () => { live = false; };
    hydrationRef.current = AsyncStorage.getItem(key).then((raw) => {
      if (!live || !raw) return;
      try {
        const parsed = JSON.parse(raw) as PersistedStage8;
        if (parsed.projection?.ownerUserId === userId) {
          const restoredProjection = parsed.projection as ChallengeProjection;
          projectionRef.current = restoredProjection;
          setProjection(restoredProjection);
        }
        const owned = Array.isArray(parsed.evidence)
          ? parsed.evidence.filter((item) => item.ownerUserId === userId)
          : [];
        evidenceRef.current = owned;
        setEvidence(owned);
        lastConsequencesRef.current = parsed.lastConsequences ?? {};
        windowsRef.current = Object.fromEntries(Object.entries(parsed.windows ?? {}).map(([key, window]) => [
          key.includes(":") ? key : `${key}:${window.windowKey}`, window,
        ]));
      } catch {
        // Corrupt Stage 8 state is ignored; legacy challenge state remains untouched.
      }
    }).catch(() => {
      dirtyRef.current = true;
    });
    return () => { live = false; };
  }, [key, userId]);

  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    retryAttemptRef.current = 0;
  }, [key, userId]);

  const ingestEvidence = useCallback(async (
    item: EvidenceReference,
    windows: Readonly<Record<string, ResolvedChallengeWindow>> = {},
  ): Promise<Stage8ConsequenceResult> => {
    const requestGeneration = generationRef.current;
    const run = async (): Promise<Stage8ConsequenceResult> => {
      await hydrationRef.current;
      if (generationRef.current !== requestGeneration) return emptyResult(item.evidenceId);
      if (!userId || ownerRef.current !== userId || item.ownerUserId !== userId) {
        return emptyResult(item.evidenceId);
      }
      const prior = evidenceRef.current.find((entry) => evidenceLineageId(entry) === evidenceLineageId(item));
      if (prior && compareEvidenceAuthority(item, prior) < 0) {
        return emptyResult(item.evidenceId);
      }
      const identicalRetry = prior && compareEvidenceAuthority(item, prior) === 0;
      if (identicalRetry && !dirtyRef.current) {
        return { ...(lastConsequencesRef.current[item.evidenceId] ?? emptyResult(item.evidenceId)),
          challengeTitles: [], achievementTitles: [] };
      }
      const allEvidence = [
        ...evidenceRef.current.filter((entry) => evidenceLineageId(entry) !== evidenceLineageId(item)),
        item,
      ];
      for (const [definitionId, window] of Object.entries(windows)) {
        windowsRef.current[`${definitionId}:${window.windowKey}`] = window;
      }
      for (const definition of STAGE_8_CHALLENGES) {
        if (definition.availability?.status === "available") continue;
        const key = `${definition.definitionId}:unavailable`;
        if (!windowsRef.current[key]) {
          windowsRef.current[key] = {
            windowKey: "unavailable",
            startInclusive: "1970-01-01T00:00:00.000Z",
            endExclusive: "9999-12-31T00:00:00.000Z",
            timezone: "UTC",
          };
        }
      }
      const priorProjection = projectionRef.current.ownerUserId === userId
        ? projectionRef.current
        : createChallengeProjection(userId);
      let nextProjection = createChallengeProjection(userId);
      for (const definition of STAGE_8_CHALLENGES) {
        const definitionWindows = Object.entries(windowsRef.current)
          .filter(([key]) => key.startsWith(`${definition.definitionId}:`))
          .map(([, window]) => window);
        for (const window of definitionWindows) {
          const result = evaluateChallenge(userId, definition, allEvidence, window);
          nextProjection = reduceChallengeProjection(nextProjection, {
            type: "apply_progress", ownerUserId: userId, progress: result.progress,
          });
        }
      }
      for (const definition of STAGE_8_ACHIEVEMENTS) {
        const result = evaluateAchievement(userId, definition, allEvidence, item.occurredAt);
        if (result.award) {
          const previous = priorProjection.awards[result.award.awardIdentity];
          nextProjection = reduceChallengeProjection(nextProjection, {
            type: "apply_award",
            ownerUserId: userId,
            award: previous?.status === "confirmed"
              ? { ...result.award, earnedAt: previous.earnedAt }
              : result.award,
          });
        }
      }
      for (const previous of Object.values(priorProjection.progress)) {
        if (!nextProjection.progress[previous.progressIdentity]) {
          nextProjection = reduceChallengeProjection(nextProjection, {
            type: "apply_progress",
            ownerUserId: userId,
            progress: { ...previous, status: "revoked", correctionVersion: previous.correctionVersion + 1 },
          });
        }
      }
      for (const previous of Object.values(priorProjection.awards)) {
        if (!nextProjection.awards[previous.awardIdentity]) {
          nextProjection = reduceChallengeProjection(nextProjection, {
            type: "apply_award",
            ownerUserId: userId,
            award: { ...previous, status: "revoked", correctionVersion: previous.correctionVersion + 1 },
          });
        }
      }
      const result = deriveStage8Consequence(
        item.evidenceId,
        priorProjection,
        nextProjection,
        Object.fromEntries(STAGE_8_CHALLENGES.map((definition) => [definition.definitionId, definition.title])),
        Object.fromEntries(STAGE_8_ACHIEVEMENTS.map((definition) => [definition.achievementId, definition.title])),
        item.qualificationStatus === "pending",
        [item.evidenceId, evidenceLineageId(item)],
      );
      projectionRef.current = nextProjection;
      evidenceRef.current = allEvidence;
      lastConsequencesRef.current[item.evidenceId] = result;
      setProjection(nextProjection);
      setEvidence(allEvidence);
      setLastConsequence(result);
      if (key) {
        try {
          await AsyncStorage.setItem(key, JSON.stringify({
            projection: nextProjection, evidence: allEvidence, lastConsequences: lastConsequencesRef.current,
            windows: windowsRef.current,
          } satisfies PersistedStage8));
          dirtyRef.current = false;
        } catch (error) {
          dirtyRef.current = true;
          const generation = generationRef.current;
          const retry = () => {
            if (!key || !dirtyRef.current || ownerRef.current !== userId || generationRef.current !== generation) return;
            void AsyncStorage.setItem(key, JSON.stringify({
              projection: projectionRef.current,
              evidence: evidenceRef.current,
              lastConsequences: lastConsequencesRef.current,
              windows: windowsRef.current,
            } satisfies PersistedStage8)).then(() => {
              dirtyRef.current = false;
              retryAttemptRef.current = 0;
              retryTimerRef.current = null;
            }).catch(() => {
              retryAttemptRef.current += 1;
              retryTimerRef.current = setTimeout(retry, Math.min(30_000, 500 * 2 ** retryAttemptRef.current));
            });
          };
          retryAttemptRef.current += 1;
          retryTimerRef.current = setTimeout(retry, Math.min(30_000, 500 * 2 ** retryAttemptRef.current));
          throw error;
        }
      }
      return result;
    };
    const result = queueRef.current.then(run, run);
    queueRef.current = result.then(() => undefined, () => undefined);
    return result;
  }, [key, userId]);

  useEffect(() => {
    if (!userId || elevationBankQuery.data?.status !== "available") return;
    for (const event of elevationBankQuery.data.recentEvents) {
      const mapped = mapElevationBankEventToEvidence(event, userId);
      if (!mapped) continue;
      const window = resolveCalendarMonthForInstant(event.effectiveAt, "Europe/London");
      void ingestEvidence({ ...mapped, windowBucketKey: window.windowKey }, { "monthly-elevation-1000": window }).catch(() => {
        // Persistence retry is scheduled by the provider; reconciliation must not
        // become an unhandled rejection in a background effect.
      });
    }
  }, [elevationBankQuery.data, ingestEvidence, userId]);

  const pendingEvidence = useMemo(
    () => evidence.filter((item) => item.qualificationStatus === "pending"),
    [evidence],
  );
  return (
    <Stage8Context.Provider value={{
      catalogue: STAGE_8_CHALLENGES, achievements: STAGE_8_ACHIEVEMENTS, projection,
      pendingEvidence, lastConsequence, ingestEvidence,
    }}>
      {children}
    </Stage8Context.Provider>
  );
}

export function useStage8() {
  return useContext(Stage8Context);
}