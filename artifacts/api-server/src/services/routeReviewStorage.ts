import { Storage } from "@google-cloud/storage";
import { sha256, type EvidenceFile } from "./routeReviewEvidence.js";

export type StoredReviewFile = { objectPath: string; sha256: string; bytes: number };
export interface ReviewFileStore {
  put(id: string, file: EvidenceFile): Promise<StoredReviewFile>;
  read(file: StoredReviewFile): Promise<Buffer>;
}
// Independent private namespace; never use the public artwork serving paths.
const prefix = "private/route-reviews/development/";
const storage = new Storage({
  credentials: {
    audience: "replit", subject_token_type: "access_token",
    token_url: "http://127.0.0.1:1106/token", type: "external_account",
    credential_source: { url: "http://127.0.0.1:1106/credential", format: { type: "json", subject_token_field_name: "access_token" } },
    universe_domain: "googleapis.com",
  } as Record<string, unknown>,
  projectId: "",
});
function bucket() {
  if (!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) throw new Error("Review file storage is unavailable");
  return storage.bucket(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID);
}
export const reviewFileStore: ReviewFileStore = {
  async put(id, file) {
    const objectPath = `${prefix}${id}/${file.name}.json`;
    await bucket().file(objectPath).save(file.bytes, {
      resumable: false, contentType: "application/json",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { cacheControl: "private, no-store", metadata: { sha256: file.sha256, scope: "development-review-only" } },
    });
    return { objectPath, sha256: file.sha256, bytes: file.bytes.length };
  },
  async read(file) {
    if (!file.objectPath.startsWith(prefix) || file.objectPath.includes("..")
      || !/^[0-9a-f]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes)
      || file.bytes < 1 || file.bytes > 2_000_000) throw new Error("Invalid private review file reference");
    const source = bucket().file(file.objectPath);
    const [metadata] = await source.getMetadata();
    if (Number(metadata.size) !== file.bytes) throw new Error("Review file size changed");
    const [bytes] = await source.download({ validation: "crc32c" });
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error("Review file integrity check failed");
    return bytes;
  },
};
