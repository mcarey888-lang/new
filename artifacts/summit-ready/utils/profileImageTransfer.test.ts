import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { profileAvatarFile, uploadProfileCover, profileImageType, PROFILE_IMAGE_MAX_BYTES } from "./profileImageTransfer";

function transport(platform = "android") {
  return {
    platform,
    fetchFile: vi.fn(async () => new Response(new Blob(["photo"], { type: "image/jpeg" }))),
    readBase64: vi.fn(async () => "cGhvdG8="),
    uploadNative: vi.fn(async () => ({ status: 200, body: '{"ok":true}' })),
  };
}
afterEach(() => vi.unstubAllGlobals());
describe("profile image platform transport", () => {
  it("sends native avatars as a Clerk-compatible data URI, not a fetched RN blob", async () => {
    const t = transport();
    expect(await profileAvatarFile({ uri: "file:///cropped.jpg" }, t)).toBe("data:image/jpeg;base64,cGhvdG8=");
    expect(t.readBase64).toHaveBeenCalledWith("file:///cropped.jpg");
    expect(t.fetchFile).not.toHaveBeenCalled();
  });
  it("accepts picker-provided base64 without reading a file again", async () => {
    const t = transport("ios");
    expect(await profileAvatarFile({ uri: "file:///crop.png", base64: "YWJj" }, t)).toBe("data:image/png;base64,YWJj");
    expect(t.readBase64).not.toHaveBeenCalled();
  });
  it("uses the cropped output type rather than the original HEIC type", () => {
    expect(profileImageType({ uri: "file:///crop.jpg", mimeType: "image/heic" })).toBe("image/jpeg");
  });
  it("keeps browser avatars as genuine blobs", async () => {
    const t = transport("web");
    expect(await profileAvatarFile({ uri: "blob:selection" }, t)).toBeInstanceOf(Blob);
    expect(t.readBase64).not.toHaveBeenCalled();
  });
  it("uploads native covers as authenticated raw bytes to the private endpoint", async () => {
    const t = transport();
    await uploadProfileCover({ uri: "file:///cover.jpg" }, "test-session", "https://test.invalid/api/activity-community/profile-cover", t);
    expect(t.uploadNative).toHaveBeenCalledWith("https://test.invalid/api/activity-community/profile-cover",
      "file:///cover.jpg", { Authorization: "Bearer test-session", "Content-Type": "image/jpeg" });
    expect(t.fetchFile).not.toHaveBeenCalled();
  });
  it("uploads browser covers as raw blobs, not JSON or multipart", async () => {
    const t = transport("web");
    const request = vi.fn(async (_url: string, _options: RequestInit) => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", request);
    await uploadProfileCover({ uri: "blob:cover", mimeType: "image/png" }, "test-session", "https://test.invalid/cover", t);
    expect(request.mock.calls[0][1]).toMatchObject({ method: "PUT", headers: { "Content-Type": "image/png" } });
    expect(request.mock.calls[0][1]?.body).toBeInstanceOf(Blob);
    expect(t.uploadNative).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 405, 413, 503])("does not report a failed cover upload (%s) as saved", async status => {
    const t = transport();
    t.uploadNative.mockResolvedValue({ status, body: "" });
    await expect(uploadProfileCover({ uri: "file:///cover.jpg" }, "test-session", "https://test.invalid/cover", t)).rejects.toThrow("not saved");
  });
  it.each(["<html>Homepage</html>", '{"ok":false}', "{}"])("rejects a 200 response without an actual upload receipt", async body => {
    const t = transport();
    t.uploadNative.mockResolvedValue({ status: 200, body });
    await expect(uploadProfileCover({ uri: "file:///cover.jpg" }, "test-session", "https://test.invalid/cover", t)).rejects.toThrow("did not confirm");
  });
  it("rejects oversized avatar and cover before any upload", async () => {
    const t = transport();
    const image = { uri: "file:///photo.jpg", fileSize: PROFILE_IMAGE_MAX_BYTES + 1 };
    await expect(profileAvatarFile(image, t)).rejects.toThrow("5 MB");
    await expect(uploadProfileCover(image, "test-session", "https://test.invalid/cover", t)).rejects.toThrow("5 MB");
    expect(t.uploadNative).not.toHaveBeenCalled();
  });
});
describe("You photo edit and refresh wiring", () => {
  const hero = readFileSync(new URL("../components/profile/PrimaryProfilePresentation.tsx", import.meta.url), "utf8");
  const editor = readFileSync(new URL("../app/edit-profile.tsx", import.meta.url), "utf8");
  it("offers both photo controls without changing the shared hero", () => {
    expect(hero).toContain('testID="profile-change-cover"');
    expect(hero).toContain('testID="profile-change-avatar"');
    expect(hero).toContain('params:{image:"cover"}');
    expect(hero).toContain('params:{image:"avatar"}');
  });
  it("reloads the owner-private cover on focus and bypasses image cache", () => {
    expect(hero).toContain("useFocusEffect(useCallback");
    expect(hero).toContain("profile-cover?refresh=");
    expect(hero).toContain('cachePolicy="none"');
    expect(hero).toContain("personalCoverState?.ownerUserId===userId");
  });
  it("uses native binary upload and leaves failed selections available to retry", () => {
    expect(editor).toContain("FileSystem.FileSystemUploadType.BINARY_CONTENT");
    expect(editor).toMatch(/await uploadProfileCover[\s\S]*?assertOwner\(\);setCover\(null\)/);
    expect(editor).toContain('button("Return to You"');
  });
});
