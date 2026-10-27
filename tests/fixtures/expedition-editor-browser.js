// Browser-test fixture ONLY. Not imported by the application.
// Evaluate in the loaded app frame, assert __QA_ART__.active, then refetch.
(() => {
  const key = "__qa_expedition_editor_fixture";
  const initial = {
    challengeId: "EXP_QA_EDITOR", challengeName: "QA editor expedition",
    targetMountainName: "Mont Blanc", targetRoute: "QA Route", regions: "Lake District",
    status: "draft", reviewed: false, updatedAt: "2026-10-27T12:00:00.000Z",
    imageVersion: 0, approved: false, limitations: ["QA fixture only"],
    stages: [
      { routeName: "QA Alpha", routeKey: "qa:alpha", distanceKm: 12, ascentM: 900 },
      { routeName: "QA Beta", routeKey: "qa:beta", distanceKm: 13, ascentM: 900 },
    ],
  };
  let row = JSON.parse(localStorage.getItem(key) || "null") || initial;
  const requests = [];
  const state = window.__QA_ART__ = {
    active: true, requests, unexpected: [], row, profileCalls: 0,
    rejectReplacement: true,
  };
  const svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#163d34"/><path d="M30 160L130 30L250 160Z" fill="#8bb3a3"/></svg>')}`;
  const source = { challengeId: "SIG_QA_ART", challengeName: "QA approved artwork",
    targetMountainName: "Mont Blanc", imageVersion: 3,
    heroUrl: svg, cardUrl: svg, thumbnailUrl: svg };
  const respond = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  }));
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function qaFetch(input, init) {
    const url = new URL(typeof input === "string" ? input : input.url || String(input), location.href);
    if (!url.pathname.startsWith("/api/")) return nativeFetch(input, init);
    const method = init?.method || input.method || "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    const path = url.pathname;
    requests.push({ path, method, body });
    if (method === "GET" && path === "/api/admin/expeditions") return respond({ expeditions: [row] });
    if (method === "GET" && path === "/api/admin/expeditions/EXP_QA_EDITOR") return respond({ expedition: row });
    if (method === "GET" && path === "/api/admin/expeditions/artwork-library") return respond({ items: [source] });
    if (method === "GET" && path === "/api/artwork/status") return respond({ challenges: [row], total: 1 });
    if (method === "POST" && path === "/api/admin/expeditions/target-profile") {
      state.profileCalls++;
      if (body?.targetRouteIdentityKey !== "qa:exact") return respond({
        code: "TARGET_ROUTE_SELECTION_REQUIRED", error: "Choose the exact QA route",
        targetMountain: { canonicalName: "Mont Blanc" },
        routes: [{ identityKey: "qa:exact", name: "QA exact route" }],
      }, 409);
      return respond({
        targetProfile: { name: "Mont Blanc", totalElevationGain: 1800, totalDistance: 25 },
        targetRoute: { identityKey: "qa:exact", name: "QA exact route" },
        provenance: { targetRouteSource: "qa_fixture", warnings: ["QA estimate, not verified navigation"] },
      });
    }
    if (method === "POST" && path === "/api/admin/expeditions/EXP_QA_EDITOR/artwork") {
      await new Promise(resolve => setTimeout(resolve, 800));
      if (body?.expectedUpdatedAt !== row.updatedAt) return respond({ error: "QA stale expedition" }, 409);
      if (body?.sourceChallengeId !== source.challengeId || body?.sourceImageVersion !== source.imageVersion) {
        return respond({ error: "QA invalid source" }, 400);
      }
      if (row.imageVersion > 0 && (!body.replaceExisting || state.rejectReplacement)) {
        return respond({ error: "QA source changed; refresh artwork" }, 409);
      }
      row = { ...row, approved: true, imageStatus: "approved", imageVersion: row.imageVersion + 1,
        heroImage: "/api/artwork/image/EXP_QA_EDITOR/hero",
        cardImage: "/api/artwork/image/EXP_QA_EDITOR/card",
        thumbnailImage: "/api/artwork/image/EXP_QA_EDITOR/thumbnail",
        updatedAt: "2026-10-27T12:01:00.000Z" };
      state.row = row;
      localStorage.setItem(key, JSON.stringify(row));
      return respond({ assigned: true, sourceChallengeId: source.challengeId,
        sourceImageVersion: source.imageVersion, imageVersion: row.imageVersion });
    }
    state.unexpected.push({ path, method });
    return respond({ error: "Blocked unexpected QA API request" }, 403);
  };
})();
