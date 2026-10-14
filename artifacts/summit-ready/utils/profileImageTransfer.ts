/** Transport only: avatars belong to Clerk, covers to the owner-private API. */
export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
type SelectedImage = { uri: string; mimeType?: string | null; fileSize?: number; base64?: string | null };
type Transport = {
  platform: string;
  fetchFile: (uri: string) => Promise<Response>;
  readBase64: (uri: string) => Promise<string>;
  uploadNative: (url: string, uri: string, headers: Record<string, string>) => Promise<{ status: number; body: string }>;
};

export function profileImageType(image: SelectedImage): string {
  // Cropping may convert the source HEIC/PNG to JPEG; use the output extension.
  const extension = image.uri.split("?")[0].split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return image.mimeType || "image/jpeg";
}

function checkSize(bytes: number) {
  if (bytes > PROFILE_IMAGE_MAX_BYTES) throw new Error("Choose or crop an image under 5 MB.");
}

async function browserFile(image: SelectedImage, transport: Transport): Promise<Blob> {
  const response = await transport.fetchFile(image.uri);
  if (!response.ok) throw new Error("Your selected image could not be read. Please choose it again.");
  const file = await response.blob();
  checkSize(file.size);
  return file;
}

export async function profileAvatarFile(image: SelectedImage, transport: Transport): Promise<Blob | string> {
  checkSize(image.fileSize ?? 0);
  if (transport.platform === "web") return browserFile(image, transport);
  // Clerk accepts a data URI. RN file:// -> fetch().blob() is not a browser File.
  const base64 = image.base64 ?? await transport.readBase64(image.uri);
  if (!base64) throw new Error("Your selected photo could not be read. Please choose it again.");
  checkSize(Math.floor(base64.length * 3 / 4));
  return `data:${profileImageType(image)};base64,${base64}`;
}

export async function uploadProfileCover(
  image: SelectedImage, token: string, url: string, transport: Transport,
): Promise<void> {
  checkSize(image.fileSize ?? 0);
  const type = profileImageType(image);
  if (!["image/jpeg", "image/png", "image/webp"].includes(type))
    throw new Error("Choose a JPEG, PNG or WebP cover image.");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": type };
  const response = transport.platform === "web"
    ? await fetch(url, { method: "PUT", headers, body: await browserFile(image, transport) })
    : await transport.uploadNative(url, image.uri, headers);
  const status = response.status;
  if (status >= 200 && status < 300) {
    const body = response instanceof Response ? await response.text() : response.body;
    let acknowledged = false;
    try { acknowledged = JSON.parse(body)?.ok === true; } catch { /* A redirected homepage is not an upload receipt. */ }
    if (!acknowledged)
      throw new Error("Your cover was not saved: the backend did not confirm the upload. Sign in again or retry after the backend repair.");
    return;
  }
  if (status === 401 || status === 403)
    throw new Error("Your cover was not saved: your session was rejected. Sign in again and retry.");
  if (status === 404 || status === 405)
    throw new Error("Your cover was not saved: this backend does not have the profile-cover repair yet.");
  if (status === 413) throw new Error("Your cover was not saved: choose an image under 5 MB.");
  throw new Error("Your cover was not saved. The service is unavailable; keep your selection and retry.");
}
