#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = resolve(
  root,
  "docs/summitready-master-asset-inventory.json",
);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function extractIconsRegistry(source, prototypeFile) {
  const match = /\bconst\s+ICONS\s*=\s*\{/.exec(source);
  assert(match, `${prototypeFile}: const ICONS registry was not found`);

  const start = match.index + match[0].length;
  let depth = 1;
  let quote = null;
  let escaped = false;
  let templateDepth = 0;
  let body = null;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (
        quote === "`" &&
        character === "$" &&
        source[index + 1] === "{"
      ) {
        templateDepth += 1;
        index += 1;
        continue;
      }
      if (quote === "`" && templateDepth > 0 && character === "}") {
        templateDepth -= 1;
        continue;
      }
      if (character === quote && templateDepth === 0) quote = null;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        body = source.slice(start, index);
        break;
      }
    }
  }

  assert(body !== null, `${prototypeFile}: unterminated ICONS registry`);

  const keys = [
    ...body.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/gm),
  ].map((entry) => entry[1]);

  return keys;
}

function sorted(values) {
  return [...values].sort();
}

function sameValues(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

try {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const records = inventory.records;
  const requiredFields = inventory.audit_metadata.record_contract.required_fields;

  assert(Array.isArray(records), "records must be an array");
  assert(
    records.length === inventory.summary_counts.total_records,
    `record total mismatch: ${records.length} != ${inventory.summary_counts.total_records}`,
  );

  const recordsByKey = new Map();
  const categoryCounts = new Map();

  for (const record of records) {
    for (const field of requiredFields) {
      assert(
        Object.hasOwn(record, field),
        `${record.asset_key ?? "<unknown>"}: missing required field ${field}`,
      );
    }
    assert(
      !recordsByKey.has(record.asset_key),
      `duplicate asset_key: ${record.asset_key}`,
    );
    assert(
      typeof record.provenance === "string" && record.provenance.trim(),
      `${record.asset_key}: provenance must be non-empty`,
    );
    assert(
      record.record_state === record.status,
      `${record.asset_key}: record_state must match safe status meaning`,
    );
    assert(
      record.generation_model === null,
      `${record.asset_key}: generation_model must initially be null`,
    );
    assert(
      Array.isArray(record.generation_history) &&
        record.generation_history.length === 0,
      `${record.asset_key}: generation_history must initially be empty`,
    );

    recordsByKey.set(record.asset_key, record);
    categoryCounts.set(
      record.category,
      (categoryCounts.get(record.category) ?? 0) + 1,
    );
  }

  for (const [category, expected] of Object.entries(
    inventory.summary_counts.by_category,
  )) {
    assert(
      categoryCounts.get(category) === expected,
      `${category}: category count ${categoryCounts.get(category) ?? 0} != ${expected}`,
    );
  }
  assert(
    categoryCounts.size ===
      Object.keys(inventory.summary_counts.by_category).length,
    "records contain a category absent from summary_counts.by_category",
  );

  const icons = records.filter(
    (record) => record.category === "STANDARD_UI_ICON",
  );
  for (const icon of icons) {
    assert(
      icon.recommended_format === "VECTOR" &&
        icon.generation_required === false &&
        icon.generation_policy === "not-generatable" &&
        icon.generation_prompt === null,
      `${icon.asset_key}: unsafe icon generation contract`,
    );
  }

  const prompts = records.filter((record) => record.generation_required);
  for (const prompt of prompts) {
    assert(
      prompt.generation_policy === "manual-only" &&
        prompt.status === "DRAFT" &&
        prompt.record_state === "DRAFT",
      `${prompt.asset_key}: prompt record must be manual-only DRAFT`,
    );
    assert(
      typeof prompt.generation_prompt === "string" &&
        prompt.generation_prompt.trim() &&
        !prompt.generation_prompt.includes("prompt_library"),
      `${prompt.asset_key}: generation_prompt is not fully resolved`,
    );
    assert(
      typeof prompt.negative_prompt === "string" &&
        prompt.negative_prompt.trim(),
      `${prompt.asset_key}: negative_prompt must be resolved`,
    );
  }
  for (const record of records.filter((entry) => !entry.generation_required)) {
    assert(
      record.generation_prompt === null &&
        record.generation_policy !== "manual-only",
      `${record.asset_key}: non-prompt record is accidentally generatable`,
    );
  }

  const sourceMap = inventory.icon_source_key_map;
  assert(Array.isArray(sourceMap), "icon_source_key_map must be an array");

  const mappingBySourceKey = new Map();
  const canonicalToSourceKeys = new Map();
  for (const mapping of sourceMap) {
    for (const field of [
      "source_key",
      "canonical_asset_key",
      "prototype_files",
      "decision",
      "notes",
    ]) {
      assert(
        Object.hasOwn(mapping, field),
        `icon source mapping is missing ${field}`,
      );
    }
    assert(
      !mappingBySourceKey.has(mapping.source_key),
      `duplicate source-key mapping: ${mapping.source_key}`,
    );
    assert(
      recordsByKey.get(mapping.canonical_asset_key)?.category ===
        "STANDARD_UI_ICON",
      `${mapping.source_key}: canonical icon does not exist: ${mapping.canonical_asset_key}`,
    );
    assert(
      Array.isArray(mapping.prototype_files) &&
        mapping.prototype_files.length > 0,
      `${mapping.source_key}: prototype_files must be non-empty`,
    );
    mappingBySourceKey.set(mapping.source_key, mapping);
    const keys = canonicalToSourceKeys.get(mapping.canonical_asset_key) ?? [];
    keys.push(mapping.source_key);
    canonicalToSourceKeys.set(mapping.canonical_asset_key, keys);
  }

  for (const [canonicalKey, sourceKeys] of canonicalToSourceKeys) {
    if (sourceKeys.length > 1) {
      assert(
        canonicalKey === "SR-ICON-ALERT" &&
          sameValues(sourceKeys, ["alert", "warn"]),
        `${canonicalKey}: only alert/warn may normalize to one canonical icon`,
      );
    }
  }

  const sourceRef = inventory.audit_metadata.source_ref;
  assert(
    typeof sourceRef === "string" && sourceRef.trim(),
    "audit_metadata.source_ref must be non-empty",
  );

  const extractedAssociations = new Map();
  let declarationOccurrences = 0;
  for (const prototypeFile of inventory.audit_metadata.approved_prototypes) {
    let source;
    try {
      source = execFileSync(
        "git",
        ["show", `${sourceRef}:${prototypeFile}`],
        { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      fail(
        `${prototypeFile}: git show failed for ${sourceRef}: ${error.stderr?.trim() || error.message}`,
      );
    }

    const declaredKeys = extractIconsRegistry(source, prototypeFile);
    assert(
      new Set(declaredKeys).size === declaredKeys.length,
      `${prototypeFile}: duplicate key inside ICONS registry`,
    );
    for (const sourceKey of declaredKeys) {
      declarationOccurrences += 1;
      const files = extractedAssociations.get(sourceKey) ?? [];
      files.push(prototypeFile);
      extractedAssociations.set(sourceKey, files);
    }
  }

  assert(
    extractedAssociations.size === mappingBySourceKey.size,
    `source-key total mismatch: extracted ${extractedAssociations.size}, mapped ${mappingBySourceKey.size}`,
  );
  for (const [sourceKey, files] of extractedAssociations) {
    const mapping = mappingBySourceKey.get(sourceKey);
    assert(mapping, `missing source-key mapping for ${sourceKey}`);
    assert(
      sameValues(mapping.prototype_files, files),
      `${sourceKey}: prototype file associations differ; extracted [${sorted(files).join(", ")}], mapped [${sorted(mapping.prototype_files).join(", ")}]`,
    );
  }
  for (const sourceKey of mappingBySourceKey.keys()) {
    assert(
      extractedAssociations.has(sourceKey),
      `extra source-key mapping not declared by a prototype: ${sourceKey}`,
    );
  }

  console.log(
    `S2-C01 asset inventory validation passed: ${records.length} records, ${icons.length} canonical icons, ${sourceMap.length} raw icon keys, ${declarationOccurrences} declaration occurrences, ${prompts.length} manual DRAFT prompts.`,
  );
} catch (error) {
  console.error(`S2-C01 asset inventory validation failed: ${error.message}`);
  process.exitCode = 1;
}