export async function readArtworkJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("json")) {
    throw new Error(
      "The Artwork API returned a webpage instead of data. Refresh this preview; if you are using a published app, publish the updated API Server too.",
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("The Artwork API returned invalid data. Please retry.");
  }

  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body &&
      typeof body.error === "string" ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  if (!body || typeof body !== "object") {
    throw new Error("The Artwork API returned an unexpected response. Please retry.");
  }
  return body as T;
}