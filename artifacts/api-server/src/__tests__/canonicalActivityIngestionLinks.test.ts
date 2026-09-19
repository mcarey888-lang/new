import { describe, expect, it } from "vitest";
import {
  ingestCanonicalActivityWithClient,
  type CanonicalActivityInput,
} from "../services/canonicalActivity";
import { canonicalActivities } from "@workspace/db/schema";

function baseInput(
  links: CanonicalActivityInput["links"],
): CanonicalActivityInput {
  return {
    ownerUserId: "owner-a",
    sourceType: "explore_hike",
    sourceId: "log-1",
    primaryContext: "free_hike",
    activityKind: "outdoor_hike",
    occurredAt: new Date("2026-09-19T10:00:00.000Z"),
    links,
  };
}

function fakeInsertClient() {
  let activityInsertCount = 0;
  let linkInsertValues: unknown[] = [];
  const activity = { id: "activity-1" } as never;

  const client = {
    insert(table: unknown) {
      return {
        values(values: unknown) {
          if (table === canonicalActivities) {
            activityInsertCount += 1;
            return {
              onConflictDoNothing() {
                return {
                  returning: async () => [activity],
                };
              },
            };
          }
          linkInsertValues = values as unknown[];
          return {
            onConflictDoNothing: async () => [],
          };
        },
      };
    },
  };

  return {
    client: client as never,
    activityInsertCount: () => activityInsertCount,
    linkInsertValues: () => linkInsertValues,
  };
}

describe("canonical ingestion link validation boundary", () => {
  it("validates and deduplicates links before direct ingestion writes", async () => {
    const fake = fakeInsertClient();
    await ingestCanonicalActivityWithClient(fake.client, baseInput([
      {
        linkType: "canonical_hill",
        targetId: "sde:mountain:f5dd0ef8-7c31-4af4-a9ed-e264753b39c6",
      },
      {
        linkType: "canonical_hill",
        targetId: "sde:mountain:f5dd0ef8-7c31-4af4-a9ed-e264753b39c6",
        metadata: { retry: 2 },
      },
    ]));

    expect(fake.activityInsertCount()).toBe(1);
    expect(fake.linkInsertValues()).toHaveLength(1);
  });

  it.each([
    {
      linkType: "canonical_route" as const,
      targetId: "sde:mountain:f5dd0ef8-7c31-4af4-a9ed-e264753b39c6",
    },
    {
      linkType: "canonical_hill" as const,
      targetId: "sde:mountain:not-a-uuid",
    },
    {
      linkType: "canonical_route" as const,
      targetId: "sde:route:missing-version",
    },
  ])("rejects malformed or mismatched SDE links before activity insert", async (link) => {
    const fake = fakeInsertClient();
    await expect(
      ingestCanonicalActivityWithClient(fake.client, baseInput([link])),
    ).rejects.toThrow();
    expect(fake.activityInsertCount()).toBe(0);
  });
});
