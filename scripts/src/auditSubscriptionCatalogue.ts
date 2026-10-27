/** Read-only billing audit. Never logs credentials or changes store configuration. */
import { getUncachableRevenueCatClient } from "./revenueCatClient";
import { listProducts, listEntitlements, listOfferings, listApps, listPackages, getProductsFromEntitlement } from "@replit/revenuecat-sdk";

async function main() {
  const project_id = process.env.REVENUECAT_PROJECT_ID;
  if (!project_id) throw new Error("REVENUECAT_PROJECT_ID is not configured");
  for (const [name, method] of Object.entries({ products: listProducts, entitlements: listEntitlements, offerings: listOfferings })) {
    const client = await getUncachableRevenueCatClient();
    const { data, error } = await method({ client, path: { project_id }, query: { limit: 100 } });
    if (error) throw new Error(`RevenueCat ${name} audit failed`);
    console.log(JSON.stringify({ resource: name, data }));
    if (name === "entitlements") {
      for (const entitlement of (data as any).items) {
        const attached = await getProductsFromEntitlement({
          client: await getUncachableRevenueCatClient(),
          path: { project_id, entitlement_id: entitlement.id }, query: { limit: 100 },
        });
        if (attached.error) throw new Error("RevenueCat entitlement attachment audit failed");
        console.log(JSON.stringify({ resource: "entitlement_products", entitlement: entitlement.lookup_key,
          data: attached.data }));
      }
    }
    if (name === "offerings") {
      for (const offering of (data as any).items) {
        const packages = await listPackages({
          client: await getUncachableRevenueCatClient(),
          path: { project_id, offering_id: offering.id },
          query: { limit: 100, expand: ["items.product"] },
        });
        if (packages.error) throw new Error("RevenueCat package audit failed");
        console.log(JSON.stringify({ resource: "packages", offering: offering.lookup_key, data: packages.data }));
      }
    }
  }
  const apps = await listApps({
    client: await getUncachableRevenueCatClient(), path: { project_id }, query: { limit: 100 },
  });
  if (apps.error) throw new Error("RevenueCat app audit failed");
  // Select public identifying fields, never configuration credentials.
  console.log(JSON.stringify({ resource: "apps", items: apps.data?.items.map(app => ({
    id: app.id, name: app.name, type: app.type,
  })) }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
