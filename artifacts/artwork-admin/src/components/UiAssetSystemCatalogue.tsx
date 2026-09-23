import { useMemo, useState } from "react";
import { BookOpenText, Check, Copy, FileCheck2, Search, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import rawCatalogue from "../../../../docs/summitready-master-asset-inventory.json";
import { UiAssetGenerateModal } from "./UiAssetGenerateModal";

export type AssetCategory =
  | "STANDARD_UI_ICON"
  | "SUMMITREADY_SYMBOL"
  | "RANK_ARTWORK"
  | "ACHIEVEMENT_ARTWORK"
  | "EDITORIAL_IMAGE"
  | "MOUNTAIN_IMAGE"
  | "EXPEDITION_IMAGE"
  | "PROFILE_IMAGE"
  | "MAP_OR_ROUTE_VISUAL"
  | "EXISTING_PROTECTED_ASSET";

export type GenerationPolicy = "not-generatable" | "manual-only" | "runtime" | "protected";

export type AssetStatus = "AUDITED" | "DRAFT" | "REFERENCE_ONLY" | "RUNTIME" | "PROTECTED";

export interface UiAssetRecord {
  asset_key: string;
  display_name: string;
  category: AssetCategory;
  subcategory: string;
  screens_used_on: string[];
  usage_context: string;
  required_variants: string[];
  recommended_format: string;
  source: string;
  status: AssetStatus;
  generation_required: boolean;
  generation_policy: GenerationPolicy;
  generation_prompt: string | null;
  negative_prompt: string | null;
  aspect_ratio: string | null;
  transparent_background: boolean | null;
  generation_model: string | null;
  generation_history: unknown[];
  provenance: string;
  record_state: string;
  notes: string;
}

interface MasterAssetInventory {
  audit_metadata: {
    audit_id: string;
    title: string;
    scope: string;
  };
  summary_counts: {
    total_records: number;
    by_category: Record<AssetCategory, number>;
    prompt_records_seeded: number;
    source_or_runtime_available: number;
    draft_or_missing_assets: number;
  };
  records: UiAssetRecord[];
}

const ASSET_CATEGORIES = new Set<AssetCategory>([
  "STANDARD_UI_ICON",
  "SUMMITREADY_SYMBOL",
  "RANK_ARTWORK",
  "ACHIEVEMENT_ARTWORK",
  "EDITORIAL_IMAGE",
  "MOUNTAIN_IMAGE",
  "EXPEDITION_IMAGE",
  "PROFILE_IMAGE",
  "MAP_OR_ROUTE_VISUAL",
  "EXISTING_PROTECTED_ASSET",
]);

const GENERATION_POLICIES = new Set<GenerationPolicy>(["not-generatable", "manual-only", "runtime", "protected"]);
const ASSET_STATUSES = new Set<AssetStatus>(["AUDITED", "DRAFT", "REFERENCE_ONLY", "RUNTIME", "PROTECTED"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function assertMasterAssetInventory(value: unknown): asserts value is MasterAssetInventory {
  if (!isObject(value) || !isObject(value.audit_metadata) || !isObject(value.summary_counts) || !Array.isArray(value.records)) {
    throw new Error("Invalid SummitReady master asset inventory structure.");
  }

  if (typeof value.summary_counts.total_records !== "number" || !isObject(value.summary_counts.by_category)) {
    throw new Error("Invalid SummitReady asset inventory summary counts.");
  }

  const seenAssetKeys = new Set<string>();
  const actualCategoryCounts = Object.fromEntries(
    Array.from(ASSET_CATEGORIES, (category) => [category, 0])
  ) as Record<AssetCategory, number>;

  value.records.forEach((record, index) => {
    if (
      !isObject(record) ||
      typeof record.asset_key !== "string" ||
      typeof record.display_name !== "string" ||
      typeof record.category !== "string" ||
      !ASSET_CATEGORIES.has(record.category as AssetCategory) ||
      typeof record.subcategory !== "string" ||
      !isStringArray(record.screens_used_on) ||
      typeof record.usage_context !== "string" ||
      !isStringArray(record.required_variants) ||
      typeof record.recommended_format !== "string" ||
      typeof record.source !== "string" ||
      typeof record.status !== "string" ||
      !ASSET_STATUSES.has(record.status as AssetStatus) ||
      typeof record.generation_required !== "boolean" ||
      typeof record.generation_policy !== "string" ||
      !GENERATION_POLICIES.has(record.generation_policy as GenerationPolicy) ||
      !(typeof record.generation_prompt === "string" || record.generation_prompt === null) ||
      !(typeof record.negative_prompt === "string" || record.negative_prompt === null) ||
      !(typeof record.aspect_ratio === "string" || record.aspect_ratio === null) ||
      !(typeof record.transparent_background === "boolean" || record.transparent_background === null) ||
      !(typeof record.generation_model === "string" || record.generation_model === null) ||
      !Array.isArray(record.generation_history) ||
      typeof record.provenance !== "string" ||
      record.provenance.trim().length === 0 ||
      typeof record.record_state !== "string" ||
      record.record_state.trim().length === 0 ||
      typeof record.notes !== "string"
    ) {
      throw new Error(`Invalid SummitReady asset record at catalogue index ${index}.`);
    }

    if (seenAssetKeys.has(record.asset_key)) {
      throw new Error(`Duplicate SummitReady asset key in catalogue: ${record.asset_key}.`);
    }
    seenAssetKeys.add(record.asset_key);

    const category = record.category as AssetCategory;
    actualCategoryCounts[category] += 1;

    if (category === "STANDARD_UI_ICON" && (record.generation_required !== false || record.generation_policy !== "not-generatable")) {
      throw new Error(`Standard UI icon ${record.asset_key} must be non-generatable.`);
    }

    if (
      record.generation_prompt !== null &&
      (record.generation_prompt.trim().length === 0 ||
        record.generation_policy !== "manual-only" ||
        record.record_state !== "DRAFT" ||
        record.generation_model !== null ||
        record.generation_history.length !== 0)
    ) {
      throw new Error(`Prompt record ${record.asset_key} must be manual-only DRAFT with curator-selected model and empty history.`);
    }

    if (record.generation_prompt === null && record.generation_required) {
      throw new Error(`Non-prompt record ${record.asset_key} cannot require generation.`);
    }
  });

  if (value.summary_counts.total_records !== value.records.length) {
    throw new Error(`SummitReady asset total mismatch: summary declares ${value.summary_counts.total_records}, catalogue contains ${value.records.length}.`);
  }

  for (const category of ASSET_CATEGORIES) {
    const declaredCount = value.summary_counts.by_category[category];
    const actualCount = actualCategoryCounts[category];

    if (typeof declaredCount !== "number" || declaredCount !== actualCount) {
      throw new Error(`SummitReady asset category mismatch for ${category}: summary declares ${String(declaredCount)}, catalogue contains ${actualCount}.`);
    }
  }
}

function parseMasterAssetInventory(value: unknown): MasterAssetInventory {
  assertMasterAssetInventory(value);
  return value;
}

const catalogue = parseMasterAssetInventory(rawCatalogue);

type FilterId = "all" | "icons" | "symbols" | "ranks" | "achievements" | "editorial" | "reference";

interface CatalogueFilter {
  id: FilterId;
  label: string;
  matches: (record: UiAssetRecord) => boolean;
}

const FILTERS: CatalogueFilter[] = [
  { id: "all", label: "All UI Assets", matches: () => true },
  { id: "icons", label: "Standard UI Icons", matches: (record) => record.category === "STANDARD_UI_ICON" },
  { id: "symbols", label: "Signature Symbols", matches: (record) => record.category === "SUMMITREADY_SYMBOL" },
  { id: "ranks", label: "Ranks", matches: (record) => record.category === "RANK_ARTWORK" },
  { id: "achievements", label: "Achievements", matches: (record) => record.category === "ACHIEVEMENT_ARTWORK" },
  { id: "editorial", label: "Editorial Images", matches: (record) => record.category === "EDITORIAL_IMAGE" },
  {
    id: "reference",
    label: "Reference / Protected",
    matches: (record) =>
      record.generation_policy === "runtime" || record.generation_policy === "protected" || record.status === "REFERENCE_ONLY",
  },
];

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  STANDARD_UI_ICON: "Standard UI Icon",
  SUMMITREADY_SYMBOL: "SummitReady Symbol",
  RANK_ARTWORK: "Rank Artwork",
  ACHIEVEMENT_ARTWORK: "Achievement Artwork",
  EDITORIAL_IMAGE: "Editorial Image",
  MOUNTAIN_IMAGE: "Mountain Image",
  EXPEDITION_IMAGE: "Expedition Image",
  PROFILE_IMAGE: "Profile Image",
  MAP_OR_ROUTE_VISUAL: "Map / Route Visual",
  EXISTING_PROTECTED_ASSET: "Existing / Protected",
};

const POLICY_LABELS: Record<GenerationPolicy, string> = {
  "not-generatable": "NOT GENERATABLE",
  "manual-only": "MANUAL ONLY",
  runtime: "RUNTIME",
  protected: "PROTECTED",
};

function policyBadgeClass(policy: GenerationPolicy) {
  switch (policy) {
    case "manual-only":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "protected":
      return "border-purple-400/30 bg-purple-400/10 text-purple-300";
    case "runtime":
      return "border-blue-400/30 bg-blue-400/10 text-blue-300";
    default:
      return "border-slate-400/30 bg-slate-400/10 text-slate-300";
  }
}

export function UiAssetSystemCatalogue() {
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [generateRecord, setGenerateRecord] = useState<UiAssetRecord | null>(null);

  const activeFilterDefinition = FILTERS.find((filter) => filter.id === activeFilter) ?? FILTERS[0];

  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((filter) => [filter.id, catalogue.records.filter(filter.matches).length])
      ) as Record<FilterId, number>,
    []
  );

  const visibleRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    return catalogue.records.filter((record) => {
      if (!activeFilterDefinition.matches(record)) return false;
      if (!normalizedQuery) return true;

      return [
        record.asset_key,
        record.display_name,
        record.usage_context,
        record.subcategory,
        ...record.screens_used_on,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeFilterDefinition, searchQuery]);

  return (
    <section
      className="overflow-hidden rounded-xl border border-primary/25 bg-card shadow-sm"
      aria-labelledby="ui-asset-system-title"
      data-testid="section-ui-asset-system"
    >
      <div className="border-b border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              S2-C01 canonical catalogue
            </div>
            <h3
              id="ui-asset-system-title"
              className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              UI ASSET SYSTEM
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Canonical inventory for reusable SummitReady UI assets. The master prompt catalogue is available here, and candidates can be generated natively within families.
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[520px]">
            <SummaryMetric label="Total records" value={catalogue.summary_counts.total_records} testId="count-ui-assets-total" />
            <SummaryMetric label="Prompt records" value={catalogue.summary_counts.prompt_records_seeded} testId="count-ui-assets-prompts" />
            <SummaryMetric label="Draft / missing" value={catalogue.summary_counts.draft_or_missing_assets} testId="count-ui-assets-draft" />
            <SummaryMetric label="Existing / runtime" value={catalogue.summary_counts.source_or_runtime_available} testId="count-ui-assets-existing" />
          </dl>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter UI asset catalogue">
          {FILTERS.map((filter) => {
            const isActive = filter.id === activeFilter;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveFilter(filter.id)}
                className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border bg-background/50 text-muted-foreground hover:border-border/80 hover:bg-secondary hover:text-foreground"
                }`}
              >
                {filter.label}
                <span className={`ml-2 font-mono ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {filterCounts[filter.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative max-w-2xl">
          <label htmlFor="ui-asset-search" className="sr-only">
            Search UI assets by key, name, usage or screen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="ui-asset-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search asset key, name, usage or screen…"
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            Showing <span className="font-semibold text-foreground">{visibleRecords.length}</span> {visibleRecords.length === 1 ? "record" : "records"}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
            Source: docs/summitready-master-asset-inventory.json
          </p>
        </div>

        {visibleRecords.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visibleRecords.map((record) => (
              <UiAssetRecordCard key={record.asset_key} record={record} onGenerate={() => setGenerateRecord(record)} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-background/40 px-6 py-12 text-center">
            <BookOpenText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-medium text-foreground">No assets found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another filter or a broader search term.</p>
          </div>
        )}
      </div>

      <UiAssetGenerateModal
        open={!!generateRecord}
        onOpenChange={(o) => !o && setGenerateRecord(null)}
        record={generateRecord || undefined}
      />
    </section>
  );
}

function SummaryMetric({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="rounded-lg border border-border/80 bg-background/55 p-3">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-semibold text-foreground" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function UiAssetRecordCard({ record, onGenerate }: { record: UiAssetRecord; onGenerate: () => void }) {
  const hasPrompt = record.generation_prompt !== null;
  const isDraftAndGeneratable = record.record_state === "DRAFT" && record.generation_required;
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const copyPrompt = async () => {
    if (!record.generation_prompt) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(record.generation_prompt);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = record.generation_prompt;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) throw new Error("Clipboard copy was rejected.");
      }
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <article className="flex min-h-full flex-col rounded-lg border border-border bg-background/45 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-[11px] font-medium text-primary">{record.asset_key}</p>
          <h4 className="mt-1 text-base font-semibold leading-snug text-foreground">{record.display_name}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {CATEGORY_LABELS[record.category]} · {record.subcategory}
          </p>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[10px] ${policyBadgeClass(record.generation_policy)}`}>
          {POLICY_LABELS[record.generation_policy]}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="outline" className="border-border bg-card text-[10px]">{record.status}</Badge>
        <Badge variant="outline" className="border-border bg-card text-[10px]">{record.recommended_format}</Badge>
        <Badge variant="outline" className={`text-[10px] ${hasPrompt ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-border bg-card text-muted-foreground"}`}>
          <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" />
          {hasPrompt ? "PROMPT PREPARED" : "NO GENERATION PROMPT"}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-3 text-xs">
        <RecordDetail label="Usage" value={record.usage_context} />
        <RecordDetail label="Screens" value={record.screens_used_on.join(", ")} />
        <RecordDetail label="Variants" value={record.required_variants.join(", ")} />
        <RecordDetail label="Source" value={record.source} mono />
      </dl>

      <details className="mt-4 rounded-md border border-border bg-card/60">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          {hasPrompt ? "Prompt details" : "Catalogue contract details"}
        </summary>

        <div className="border-t border-border p-3">
          {hasPrompt ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Fully resolved generation prompt
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyPrompt}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {copyStatus === "copied" ? (
                      <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {copyStatus === "copied" ? "Copied" : "Copy"}
                  </button>
                  {isDraftAndGeneratable && (
                    <button
                      type="button"
                      onClick={onGenerate}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      Create Candidate
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap rounded border border-border bg-background/70 p-3 text-xs leading-5 text-foreground/90">
                {record.generation_prompt}
              </p>
              <div className="mt-3">
                <RecordDetail label="Negative prompt" value={record.negative_prompt ?? "None specified"} />
              </div>
            </>
          ) : null}

          <dl className={`grid gap-3 text-xs ${hasPrompt ? "mt-3" : ""}`}>
            {hasPrompt ? (
              <>
                <RecordDetail label="Aspect ratio" value={record.aspect_ratio ?? "Not specified"} />
                <RecordDetail
                  label="Transparent background"
                  value={record.transparent_background === null ? "Not specified" : record.transparent_background ? "Required" : "Not required"}
                />
              </>
            ) : null}
            <RecordDetail label="Selected model" value={record.generation_model ?? "CURATOR SELECTS AT TRIGGER"} />
            <RecordDetail label="Generation history" value={`${record.generation_history.length} ${record.generation_history.length === 1 ? "entry" : "entries"}`} />
            <RecordDetail label="Provenance" value={record.provenance} />
          </dl>
        </div>
      </details>
    </article>
  );
}

function RecordDetail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-words leading-5 text-foreground/85 ${mono ? "font-mono text-[11px]" : ""}`} title={value}>
        {value}
      </dd>
    </div>
  );
}
