import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("membership codegen preserves the private community photo's raw binary transport", () => {
  const source = readFileSync(new URL("../../../../lib/api-client-react/src/generated/api.ts", import.meta.url), "utf8");
  expect(/uploadCommunityPostPhotoBody:\s*Blob/.test(source)).toBe(true);
  expect(/body:\s*uploadCommunityPostPhotoBody[,\s}]/.test(source)).toBe(true);
  expect(/body:\s*JSON\.stringify\(uploadCommunityPostPhotoBody\)/.test(source)).toBe(false);
});
