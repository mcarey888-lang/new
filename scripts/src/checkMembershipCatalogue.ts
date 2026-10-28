/** Read-only catalogue diagnostic. Never prints customer data or credentials. */
import { getProductsFromEntitlement, getProductsFromPackage, listApps, listEntitlements, listOfferings, listPackages, listProducts } from "@replit/revenuecat-sdk";
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
  const [apps, offerings] = await Promise.all([
    listApps({ client, path, query: { limit: 100 } }),
    listOfferings({ client, path, query: { limit: 100 } }),
  ]);
  if (apps.error || offerings.error) throw new Error("RevenueCat offerings could not be read");
  const packages = await Promise.all((offerings.data?.items ?? []).map(async offering => {
    const result = await listPackages({ client, path: { ...path, offering_id: offering.id }, query: { limit: 100 } });
    if (result.error) throw new Error("RevenueCat packages could not be read");
    const items = await Promise.all((result.data?.items ?? []).map(async pkg => {
      const attached = await getProductsFromPackage({ client, path: { ...path, package_id: pkg.id }, query: { limit: 100 } });
      if (attached.error) throw new Error("RevenueCat package links could not be read");
      return { package: pkg.lookup_key, products: attached.data?.items };
    }));
    return { offering: offering.lookup_key, packages: items };
  }));
  console.log(JSON.stringify({
    apps: apps.data?.items.map(app => ({ id: app.id, name: app.name, type: app.type })),
    offerings: packages,
    links,
    entitlements: entitlements.data?.items.map(e => ({ id: e.id, lookupKey: e.lookup_key })),
    products: products.data?.items.map(p => ({ id: p.id, storeIdentifier: p.store_identifier, appId: p.app_id })),
  }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
