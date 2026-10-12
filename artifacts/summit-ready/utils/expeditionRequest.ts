/** Bound the whole response, including JSON decoding, not just response headers. */
export async function fetchExpeditionResponse(
  url: string,
  payload: Record<string, unknown>,
  signal: AbortSignal,
  timeoutMs = 90_000,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: () => void = () => {};
  const interruption = new Promise<never>((_, reject) => {
    cancel = () => {
      reject(new Error("Expedition search cancelled."));
      controller.abort();
    };
    timer = setTimeout(() => {
      reject(new Error("Finding suitable summits is taking too long. Your choices are unchanged. Please retry, or edit the search area."));
      controller.abort();
    }, timeoutMs);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
  try {
    return await Promise.race([
      interruption,
      (async () => {
        const response = await fetcher(url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), signal: controller.signal,
        });
        let body: unknown;
        try { body = await response.json(); }
        catch {
          throw new Error(`The expedition service returned an unreadable response (${response.status}). Please retry.`);
        }
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          throw new Error("The expedition service returned an incomplete response. Please retry.");
        }
        return { ok: response.ok, status: response.status, body: body as Record<string, unknown> };
      })(),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
