import { useState } from "react";
import { ArtworkAdminHeader } from "@/components/ArtworkAdminHeader";
import { UiAssetSystemCatalogue } from "@/components/UiAssetSystemCatalogue";
import { UiAssetFamilies } from "@/components/UiAssetFamilies";
import { UiAssetCandidates } from "@/components/UiAssetCandidates";
import { UiAssetHistoryView } from "@/components/UiAssetHistoryView";
import { Input } from "@/components/ui/input";
import { LockKeyhole } from "lucide-react";
import { AdminKeyContext } from "@/contexts/AdminKeyContext";

type TabValue = "catalogue" | "families" | "candidates" | "history";

export default function UiAssetsPage() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("summitready-admin-key") ?? "");
  const [activeTab, setActiveTab] = useState<TabValue>("catalogue");

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
            <LockKeyhole className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
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
          <div className="w-full">
            <div className="flex border-b border-border overflow-x-auto no-scrollbar">
              {(["catalogue", "families", "candidates", "history"] as TabValue[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                    activeTab === tab
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {activeTab === "catalogue" && <UiAssetSystemCatalogue />}
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
