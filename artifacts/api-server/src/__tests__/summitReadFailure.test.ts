import { describe, expect, it } from "vitest";
import { summitReadFailure } from "../services/summits/summitReadFailure";

describe("safe summit catalogue diagnostics", () => {
  it("identifies missing engine configuration without exposing secrets", () => {
    expect(summitReadFailure(new Error("ENGINE_DATABASE_URL is not configured"))).toBe("engine_not_configured");
  });
  it.each([
    ["ECONNREFUSED", "database_connection_refused"],
    ["ENOTFOUND", "database_host_unreachable"],
    ["28P01", "database_authentication_failed"],
    ["42501", "database_permission_denied"],
    ["42P01", "catalogue_table_missing"],
    ["42703", "catalogue_column_missing"],
    ["42883", "catalogue_function_missing"],
    ["57014", "catalogue_query_timeout"],
  ])("classifies %s safely", (code, expected) => {
    expect(summitReadFailure({ code, message: "private connection details", stack: "private stack" })).toBe(expected);
  });
  it("does not echo arbitrary messages, codes or prototype properties", () => {
    for (const error of [null, undefined, "private message", { message: "private connection details" },
      { code: "private connection details" }, { code: "toString" }, { code: "__proto__" }]) {
      expect(summitReadFailure(error)).toBe("unknown");
    }
  });
});
