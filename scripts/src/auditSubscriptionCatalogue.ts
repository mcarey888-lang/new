/** Read-only billing audit. Never logs credentials or changes store configuration. */
import { getUncachableRevenueCatClient } from "./revenueCatClient";
import { listProducts, listEntitlements, listOfferings } from "@replit/revenuecat-sdk";

async function main() {
  const project_id = process.env.REVENUECAT_PROJECT_ID;
  if (!project_id) throw new Error("REVENUECAT_PROJECT_ID is not configured");
  for (const [name, method] of Object.entries({ products: listProducts, entitlements: listEntitlements, offerings: listOfferings })) {
    const client = await getUncachableRevenueCatClient();
    const { data, error } = await method({ client, path: { project_id }, query: { limit: 100 } });
    if (error) throw new Error(`RevenueCat ${name} audit failed`);
    console.log(JSON.stringify({ resource: name, data }));
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
