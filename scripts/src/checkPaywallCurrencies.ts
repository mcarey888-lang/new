/** Read-only catalogue/preview-price check. Does not modify store products. */
import { listApps, listOfferings, listPackages, getProductsFromPackage } from "@replit/revenuecat-sdk";
import { getUncachableRevenueCatClient } from "./revenueCatClient";

async function main() {
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) throw new Error("RevenueCat project is not configured");
  const client = await getUncachableRevenueCatClient();
  const path = { project_id: projectId };
  const apps = await listApps({ client, path, query: { limit: 100 } });
  const offerings = await listOfferings({ client, path, query: { limit: 100 } });
  if (apps.error || offerings.error) throw new Error("Could not read RevenueCat catalogue");
  for (const offering of offerings.data?.items ?? []) {
    const packages = await listPackages({
      client, path: { ...path, offering_id: offering.id }, query: { limit: 100 },
    });
    if (packages.error) throw new Error("Could not read offering packages");
    for (const pkg of packages.data?.items ?? []) {
      const products = await getProductsFromPackage({
        client, path: { ...path, package_id: pkg.id }, query: { limit: 100 },
      });
      if (products.error) throw new Error("Could not read package products");
      for (const { product } of products.data?.items ?? []) {
        const app = apps.data?.items.find(app => app.id === product.app_id);
        let prices: unknown = "Native price comes from the customer's Apple/Google storefront";
        if (app?.type === "test_store") {
          const result = await client.get({
            url: "/projects/{project_id}/products/{product_id}/test_store_prices",
            path: { ...path, product_id: product.id },
          });
          if (result.error) throw new Error("Could not read preview prices");
          prices = result.data;
          const amount = pkg.lookup_key === "$rc_monthly"
            ? offering.lookup_key === "expeditions" ? 4_990_000 : 9_990_000
            : pkg.lookup_key === "$rc_annual"
              ? offering.lookup_key === "expeditions" ? 34_990_000 : 69_990_000
              : undefined;
          if (amount !== undefined && ["default", "pro", "expeditions"].includes(offering.lookup_key)) {
            const configured = prices as Array<{ currency: string; amount_micros: number }>;
            if (configured.length !== 1 || configured[0].currency !== "GBP" || configured[0].amount_micros !== amount)
              throw new Error("Preview package does not match its agreed GBP price");
          }
        }
        console.log(JSON.stringify({
          offering: offering.lookup_key, package: pkg.lookup_key,
          store: app?.type, product: product.store_identifier, prices,
        }));
      }
    }
  }
}

main().catch(() => {
  console.error("Read-only paywall currency check failed; no prices were changed.");
  process.exitCode = 1;
});
