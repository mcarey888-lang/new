/**
 * Restricted operator tool; defaults to read-only. Never invoked by tests.
 * Run with the API server's normal development/production credentials.
 * No bulk cleanup mode and no customer identity or identifier output.
 */
import { db, pool, privacyLockPool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { runAccountDeletion } from "../services/accountDeletion";
import type { DeletionState } from "../services/accountDeletionFlow";

const args = process.argv.slice(2);
function flag(key: string) { return args[args.indexOf(key) + 1]; }
const id = args.includes("--request") ? flag("--request") : "";
if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Supply one --request UUID. No bulk mode is available.");
try {
  const result = await db.execute(sql`SELECT owner_user_id,state FROM privacy_deletion_jobs WHERE id=${id}`);
  if (!result.rows.length) throw new Error("Request not found");
  const row = result.rows[0] as { owner_user_id: string; state: DeletionState };
  if (args.includes("--retry") || args.includes("--resolve-provider")) {
    if (!args.includes("--execute")) throw new Error("Mutation requires --execute after review.");
    if (process.env.NODE_ENV === "production" && !args.includes("--approved-production-request")) throw new Error("Production requires explicit per-request approval.");
    if (args.includes("--retry")) {
      console.log(await runAccountDeletion(row.owner_user_id));
    } else {
      const provider = flag("--resolve-provider"), status = flag("--status"), caseRef = flag("--case");
      if (!(provider in row.state.providers) || !["deleted", "retained_lawfully"].includes(status) ||
          !/^[A-Za-z0-9_-]{3,100}$/.test(caseRef)) throw new Error("Supply a known provider, valid status and opaque case reference (never credentials/PII).");
      const evidence = { caseRef, basis: args.includes("--basis") ? flag("--basis") : undefined, reviewAfter: args.includes("--review-after") ? flag("--review-after") : undefined };
      if (status === "retained_lawfully" && (!evidence.basis || !evidence.reviewAfter || !Number.isFinite(Date.parse(evidence.reviewAfter)))) throw new Error("Retained records need a verified lawful basis and review-after date.");
      row.state.providers[provider] = status as "deleted" | "retained_lawfully";
      row.state.providerEvidence ??= {};
      row.state.providerEvidence[provider] = evidence;
      // Identifiers are only for erasure matching, not indefinite analytics.
      if (Object.values(row.state.providers).every(value => value !== "pending_review")) delete row.state.erasureIdentifiers;
      await db.execute(sql`UPDATE privacy_deletion_jobs SET state=${JSON.stringify(row.state)}::jsonb,updated_at=now() WHERE id=${id}`);
    }
  } else {
    console.log({
      requestId: id, completed: row.state.completed, remainingMedia: row.state.media.length,
      providers: row.state.providers, hasErasureIdentifiers: Boolean(Object.keys(row.state.erasureIdentifiers ?? {}).length),
    });
  }
} finally { await pool.end(); await privacyLockPool.end(); }
