/** Read-only catalogue diagnostic. Never prints customer data or credentials. */
import { getProductsFromEntitlement, listEntitlements, listProducts } from "@replit/revenuecat-sdk";
import { getUncachableRevenueCatClient } from "./revenueCatClient";

async function main() {
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) throw new Error("REVENUECAT_PROJECT_ID is not configured");
  const client = await getUncachableRevenueCatClient();
  const path = { project_id: projectId };
  const [entitlements, products] = await Promise.all([
    listEntitlements({ client, path, query: { limit: 100 } }),
    listProducts({ client, path, query: { limit: 100 } }),
  ]);
  if (entitlements.error || products.error) throw new Error("RevenueCat catalogue could not be read");
  const links = await Promise.all((entitlements.data?.items ?? []).map(async e => {
    const result = await getProductsFromEntitlement({
      client, path: { ...path, entitlement_id: e.id }, query: { limit: 100 },
    });
    if (result.error) throw new Error("RevenueCat entitlement links could not be read");
    return { entitlement: e.lookup_key, products: result.data?.items.map(p => p.store_identifier) };
  }));
  console.log(JSON.stringify({
    links,
    entitlements: entitlements.data?.items.map(e => ({ id: e.id, lookupKey: e.lookup_key })),
    products: products.data?.items.map(p => ({ id: p.id, storeIdentifier: p.store_identifier, appId: p.app_id })),
  }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
