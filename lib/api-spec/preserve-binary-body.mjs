import { readFileSync, writeFileSync } from "node:fs";

// Orval currently JSON-serializes this Blob request. Keep normal JSON requests
// unchanged and make regeneration preserve the existing raw-image contract.
const file = new URL("../api-client-react/src/generated/api.ts", import.meta.url);
const source = readFileSync(file, "utf8");
const wrong = /body\s*:\s*JSON\.stringify\(\s*uploadCommunityPostPhotoBody\s*\)/;
const correct = "body: uploadCommunityPostPhotoBody";
if (wrong.test(source)) writeFileSync(file, source.replace(wrong, correct));
else if (!/body\s*:\s*uploadCommunityPostPhotoBody/.test(source))
  throw new Error("Generated community image transport changed; inspect raw binary handling.");
