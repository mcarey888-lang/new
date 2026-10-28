/**
 * Preview-only Expeditions setup. Run without --apply for a read-only check.
 * Re-running --apply repairs missing links, never touches Apple or Google products.
 */
import {
  attachProductsToEntitlement, attachProductsToPackage, createProduct,
  getProductsFromEntitlement, getProductsFromPackage,
  listApps, listEntitlements, listOfferings, listPackages, listProducts,
} from "@replit/revenuecat-sdk";
import { getUncachableRevenueCatClient } from "./revenueCatClient";

async function main() {
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) throw new Error("RevenueCat project ID not configured");
  const apply = process.argv.includes("--apply");
  const client = await getUncachableRevenueCatClient();
  const path = { project_id: projectId };
  const [apps, offerings, entitlements, products] = await Promise.all([
    listApps({ client, path, query: { limit: 100 } }),
    listOfferings({ client, path, query: { limit: 100 } }),
    listEntitlements({ client, path, query: { limit: 100 } }),
    listProducts({ client, path, query: { limit: 100 } }),
  ]);
  if (apps.error || offerings.error || entitlements.error || products.error)
    throw new Error("Could not read RevenueCat catalogue; no changes made");
  const testApp = apps.data?.items.find(a => a.type === "test_store");
  const offering = offerings.data?.items.find(o => o.lookup_key === "expeditions");
  const entitlement = entitlements.data?.items.find(e => e.lookup_key === "expeditions");
  if (!testApp || !offering || !entitlement)
    throw new Error("Existing Test Store, Expeditions offering, or entitlement is missing; no changes made");
  const [packages, linked] = await Promise.all([
    listPackages({ client, path: { ...path, offering_id: offering.id }, query: { limit: 100 } }),
    getProductsFromEntitlement({ client, path: { ...path, entitlement_id: entitlement.id }, query: { limit: 100 } }),
  ]);
  if (packages.error || linked.error) throw new Error("Could not read existing Expeditions links; no changes made");
  for (const config of [
    { key: "$rc_monthly", identifier: "summit_ready_expeditions_monthly", duration: "P1M" as const, amount: 4_990_000 },
    { key: "$rc_annual", identifier: "summit_ready_expeditions_annual", duration: "P1Y" as const, amount: 34_990_000 },
  ]) {
    const pkg = packages.data?.items.find(p => p.lookup_key === config.key);
    if (!pkg) throw new Error(`Existing Expeditions ${config.key} package is missing`);
    let product = products.data?.items.find(p => p.app_id === testApp.id && p.store_identifier === config.identifier);
    if (!product && apply) {
      const created = await createProduct({
        client, path, body: {
          app_id: testApp.id, store_identifier: config.identifier, type: "subscription",
          display_name: `SummitReady Expeditions ${config.key === "$rc_monthly" ? "Monthly" : "Annual"} (Preview)`,
          title: `SummitReady Expeditions ${config.key === "$rc_monthly" ? "Monthly" : "Annual"}`,
          subscription: { duration: config.duration },
        },
      });
      if (created.error || !created.data) throw new Error(`Could not create ${config.key} preview product`);
      product = created.data;
    }
    if (!product) {
      console.log(`${config.key}: missing preview product (would create)`);
      continue;
    }
    if (product.app_id !== testApp.id) throw new Error("Refusing to modify a native store product");
    // Test Store prices are independent of Apple and Play. Supply the agreed UK
    // target for the en-GB browser preview; never claim native prices are verified.
    const prices = await client.get({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { ...path, product_id: product.id },
    });
    if (prices.error) throw new Error(`Could not read ${config.key} preview prices`);
    const currentPrices = Array.isArray(prices.data) ? prices.data as Array<{ currency: string; amount_micros: number }> : [];
    const gbp = currentPrices.find(p => p.currency === "GBP");
    if (gbp && gbp.amount_micros !== config.amount)
      throw new Error(`Existing ${config.key} preview price differs; refusing to change it`);
    if (!gbp && apply) {
      const added = await client.post({
        url: "/projects/{project_id}/products/{product_id}/test_store_prices",
        path: { ...path, product_id: product.id },
        body: { prices: [{ currency: "GBP", amount_micros: config.amount }] },
      });
      if (added.error) throw new Error(`Could not add ${config.key} GBP preview price`);
    }
    const attached = await getProductsFromPackage({
      client, path: { ...path, package_id: pkg.id }, query: { limit: 100 },
    });
    if (attached.error) throw new Error(`Could not read ${config.key} package associations`);
    const inPackage = attached.data?.items.some(item => item.product.id === product.id);
    if (!inPackage && apply) {
      const result = await attachProductsToPackage({
        client, path: { ...path, package_id: pkg.id },
        body: { products: [{ product_id: product.id, eligibility_criteria: "all" }] },
      });
      if (result.error) throw new Error(`Could not link ${config.key} preview package`);
    }
    const hasEntitlement = linked.data?.items.some(p => p.id === product.id);
    if (!hasEntitlement && apply) {
      const result = await attachProductsToEntitlement({
        client, path: { ...path, entitlement_id: entitlement.id }, body: { product_ids: [product.id] },
      });
      if (result.error) throw new Error(`Could not link ${config.key} preview entitlement`);
    }
    console.log(`${config.key}: preview product present; GBP price ${gbp ? "present" : apply ? "added" : "missing"}; package ${inPackage ? "linked" : apply ? "linked" : "missing"}; entitlement ${hasEntitlement ? "linked" : apply ? "linked" : "missing"}`);
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Preview setup failed"); process.exitCode = 1; });
