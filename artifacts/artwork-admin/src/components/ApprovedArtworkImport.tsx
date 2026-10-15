import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { adminKeyHeader } from "@/lib/adminKey";
import { readArtworkJson } from "@/lib/artworkResponse";

type Plan = {
  planId: string; database: string; applied: boolean; insertedRecords: number;
  mountainsToImport: number; mountainsPreserved: number; recordsToInsert: number;
  items: { id: string; name: string; action: "insert" | "preserve" }[];
};

export function ApprovedArtworkImport({ adminKey }: { adminKey: string }) {
  const cache = useQueryClient();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [backup, setBackup] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  // A preview made with another key cannot authorise this action.
  const [previewKey, setPreviewKey] = useState("");
  const validPlan = plan && previewKey === adminKey ? plan : null;

  async function request(apply: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = await readArtworkJson<Plan>(await fetch("/api/artwork/approved-library-import", {
        method: apply ? "POST" : "GET",
        headers: { ...adminKeyHeader(adminKey), ...(apply ? { "Content-Type": "application/json" } : {}) },
        ...(apply ? { body: JSON.stringify({ planId: validPlan?.planId, backupConfirmed: backup, confirmation }) } : {}),
      }));
      setPlan(result);
      setPreviewKey(adminKey);
      setConfirmation("");
      setBackup(false);
      if (apply) await cache.invalidateQueries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setPlan(null);
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-lg border border-border bg-card p-4 space-y-3" aria-label="Approved artwork library import">
    <h2 className="font-semibold">Restore the approved artwork library</h2>
    <p className="text-sm text-muted-foreground">
      Import the existing 33-mountain collection into this server’s database. No new images, catalogue changes
      or user data changes. Existing artwork decisions are preserved. Nothing runs automatically on publishing.
    </p>
    <p className="text-sm">Server: {window.location.origin} · Use the published admin page to import into production.</p>
    <Button disabled={busy || !adminKey.trim()} onClick={() => request(false)}>
      {busy ? "Working…" : "Preview approved artwork import"}
    </Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {validPlan && <div className="space-y-3">
      <p className="text-sm">Database: {validPlan.database} · {validPlan.mountainsToImport} mountains to import
        {" · "}{validPlan.mountainsPreserved} preserved · {validPlan.recordsToInsert} metadata records.</p>
      <details><summary className="cursor-pointer">Review mountain list</summary>
        <ul className="text-sm mt-2">{validPlan.items.map(item =>
          <li key={item.id}>{item.name} — {item.action === "insert" ? "import" : "preserve existing"}</li>)}</ul>
      </details>
      {validPlan.applied ? <p role="status">Import complete: {validPlan.insertedRecords} records added. Existing decisions were not overwritten.</p>
        : validPlan.recordsToInsert > 0 ? <>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={backup} onChange={event => setBackup(event.target.checked)} />
            I have confirmed a current backup or PITR recovery point for this database.
          </label>
          <label className="block text-sm">Type IMPORT APPROVED ARTWORK to authorise this database change
            <input className="block border rounded bg-background p-2 mt-1 w-full max-w-md"
              value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" />
          </label>
          <Button disabled={busy || !backup || confirmation !== "IMPORT APPROVED ARTWORK"} onClick={() => request(true)}>
            Approve and import existing artwork
          </Button>
        </> : <p role="status">No import needed. Existing decisions are preserved.</p>}
    </div>}
  </section>;
}
