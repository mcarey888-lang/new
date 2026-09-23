import { useState } from "react";
import { ArtworkAdminHeader } from "@/components/ArtworkAdminHeader";
import { UiAssetSystemCatalogue } from "@/components/UiAssetSystemCatalogue";
import { UiAssetFamilies } from "@/components/UiAssetFamilies";
import { UiAssetCandidates } from "@/components/UiAssetCandidates";
import { UiAssetHistoryView } from "@/components/UiAssetHistoryView";
import { UiAssetConcepts } from "@/components/UiAssetConcepts";
import { UiAssetBulkPanel } from "@/components/UiAssetBulkPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, LockKeyhole } from "lucide-react";
import { AdminKeyContext } from "@/contexts/AdminKeyContext";
import { UiAssetManifestError, useUiAssetManifest } from "@/hooks/useUiAssetWorkflow";

const tabs = ["catalogue", "concepts", "families", "candidates", "history"] as const;
type TabValue = (typeof tabs)[number];

export default function UiAssetsPage() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("summitready-admin-key") ?? "");
  const [activeTab, setActiveTab] = useState<TabValue>(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tabs.find((value) => value === tab) ?? "catalogue";
  });

  const selectTab = (tab: TabValue) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
    setActiveTab(tab);
  };

  const persistAdminKey = (value: string) => {
    setAdminKey(value);
    if (value) sessionStorage.setItem("summitready-admin-key", value);
    else sessionStorage.removeItem("summitready-admin-key");
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-background font-sans text-foreground"
      data-testid="page-ui-assets"
    >
      <ArtworkAdminHeader activeSection="ui-assets" />

      <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-4xl flex-col gap-2">
            <h2 className="text-3xl font-semibold tracking-tight">UI Asset System</h2>
            <p className="text-sm leading-6 text-muted-foreground sm:text-base">
              Manage the canonical UI asset catalogue and the family-aware generation workflow.
            </p>
          </div>
          <form className="relative w-full sm:w-64" onSubmit={(e) => e.preventDefault()}>
            <input
              className="sr-only"
              type="text"
              name="username"
              autoComplete="username"
              value="SummitReady Artwork Admin"
              readOnly
              tabIndex={-1}
              aria-hidden="true"
            />
            <LockKeyhole className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              name="admin-key"
              autoComplete="current-password"
              aria-label="Admin API key"
              placeholder="Admin key for workflow actions"
              value={adminKey}
              onChange={(e) => persistAdminKey(e.target.value)}
              className="w-full pl-9"
            />
          </form>
        </div>

        <AdminKeyContext.Provider value={adminKey}>
          <AdminKeyStatus
            hasKey={Boolean(adminKey.trim())}
            onClear={() => persistAdminKey("")}
          />
          <div className="w-full">
            <div className="flex border-b border-border overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => selectTab(tab)}
                  className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                    activeTab === tab
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "concepts" ? "Concepts (12)" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {activeTab === "catalogue" && (
                <div className="space-y-6">
                  <UiAssetBulkPanel onNavigate={selectTab} />
                  <UiAssetSystemCatalogue />
                </div>
              )}
              {activeTab === "concepts" && <UiAssetConcepts />}
              {activeTab === "families" && <UiAssetFamilies />}
              {activeTab === "candidates" && <UiAssetCandidates />}
              {activeTab === "history" && <UiAssetHistoryView />}
            </div>
          </div>
        </AdminKeyContext.Provider>
      </main>
    </div>
  );
}

function AdminKeyStatus({
  hasKey,
  onClear,
}: {
  hasKey: boolean;
  onClear: () => void;
}) {
  const manifest = useUiAssetManifest();

  if (!hasKey || manifest.isPending || manifest.data) return null;

  const rejected = manifest.error instanceof UiAssetManifestError
    && (manifest.error.status === 401 || manifest.error.status === 403);

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="font-semibold text-foreground">
            {rejected ? "Admin key rejected" : "Artwork service temporarily unavailable"}
          </p>
          <p className="text-muted-foreground">
            {rejected
              ? "The saved key is no longer valid. Clear it and enter the current workspace admin key."
              : manifest.error instanceof UiAssetManifestError && manifest.error.status === 429
                ? "Too many requests. Wait a minute and retry. Your admin key is still saved."
                : "The workflow could not be loaded. Retry without clearing your saved admin key."}
          </p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={rejected ? onClear : () => void manifest.refetch()}>
        {rejected ? "Clear and re-enter" : "Retry"}
      </Button>
    </div>
  );
}
