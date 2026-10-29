/**
 * Repair browser Test Store pricing only. Dry-run unless --apply is supplied.
 * Replacement products avoid SDK resolution of stale USD/legacy preview prices.
 * Never edits native products, receipts, customers or activity records.
 */
import {
  attachProductsToEntitlement, attachProductsToPackage, createProduct,
  deleteProduct, detachProductsFromPackage, getProductsFromEntitlement,
  getProductsFromPackage, listApps, listEntitlements, listOfferings,
  listPackages, listProducts,
} from "@replit/revenuecat-sdk";
import { getUncachableRevenueCatClient } from "./revenueCatClient";

const plans = [
  { old: "summit_ready_premium_monthly", next: "summit_ready_pro_monthly_gbp_999", amount: 9_990_000, duration: "P1M" as const, label: "Monthly GBP" },
  { old: "summit_ready_premium_annual", next: "summit_ready_pro_annual_gbp_6999", amount: 69_990_000, duration: "P1Y" as const, label: "Annual GBP" },
];

async function main() {
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) throw new Error("RevenueCat project not configured");
  const apply = process.argv.includes("--apply");
  const client = await getUncachableRevenueCatClient();
  const path = { project_id: projectId };
  const [apps, products, offerings, entitlements] = await Promise.all([
    listApps({ client, path, query: { limit: 100 } }),
    listProducts({ client, path, query: { limit: 100 } }),
    listOfferings({ client, path, query: { limit: 100 } }),
    listEntitlements({ client, path, query: { limit: 100 } }),
  ]);
  if (apps.error || products.error || offerings.error || entitlements.error)
    throw new Error("Could not read preview catalogue");
  const testApp = apps.data?.items.find(app => app.type === "test_store");
  if (!testApp) throw new Error("Test Store missing");
  const packageLinks = [];
  for (const offering of offerings.data?.items ?? []) {
    const packages = await listPackages({ client, path: { ...path, offering_id: offering.id }, query: { limit: 100 } });
    if (packages.error) throw new Error("Could not read packages");
    for (const pkg of packages.data?.items ?? []) {
      const linked = await getProductsFromPackage({ client, path: { ...path, package_id: pkg.id }, query: { limit: 100 } });
      if (linked.error) throw new Error("Could not read package links");
      packageLinks.push({ pkg, products: linked.data?.items.map(item => item.product) ?? [] });
    }
  }
  const entitlementLinks = [];
  for (const entitlement of entitlements.data?.items ?? []) {
    const linked = await getProductsFromEntitlement({ client, path: { ...path, entitlement_id: entitlement.id }, query: { limit: 100 } });
    if (linked.error) throw new Error("Could not read entitlement links");
    entitlementLinks.push({ entitlement, products: linked.data?.items ?? [] });
  }
  for (const plan of plans) {
    const old = products.data?.items.find(product => product.app_id === testApp.id && product.store_identifier === plan.old);
    let replacement = products.data?.items.find(product => product.app_id === testApp.id && product.store_identifier === plan.next);
    if (!old && !replacement) throw new Error("Expected preview product missing");
    console.log(`${plan.label}: ${apply ? "applying" : "would apply"} GBP ${(plan.amount / 1e6).toFixed(2)}; native products unchanged`);
    if (!apply) continue;
    if (!replacement) {
      const created = await createProduct({
        client, path, body: {
          app_id: testApp.id, store_identifier: plan.next, type: "subscription",
          display_name: `SummitReady Pro ${plan.label} (Preview)`,
          title: `SummitReady Pro ${plan.label}`,
          subscription: { duration: plan.duration },
        },
      });
      if (created.error || !created.data) throw new Error("Could not create GBP preview product");
      replacement = created.data;
    }
    if (replacement.app_id !== testApp.id || (old && old.app_id !== testApp.id))
      throw new Error("Refusing to modify native products");
    const productPath = { ...path, product_id: replacement.id };
    const readPrices = () => client.get({ url: "/projects/{project_id}/products/{product_id}/test_store_prices", path: productPath });
    const existingPrices = await readPrices();
    if (existingPrices.error) throw new Error("Could not read replacement prices");
    const prices = existingPrices.data as Array<{ currency: string; amount_micros: number }>;
    if (prices.some(price => price.currency !== "GBP" || price.amount_micros !== plan.amount))
      throw new Error("Replacement already has unexpected prices; refusing to overwrite");
    if (!prices.length) {
      const written = await client.post({
        url: "/projects/{project_id}/products/{product_id}/test_store_prices",
        path: productPath, body: { prices: [{ currency: "GBP", amount_micros: plan.amount }] },
      });
      if (written.error) throw new Error("Could not set GBP preview price");
    }
    if (old) {
      for (const link of entitlementLinks.filter(link => link.products.some(product => product.id === old.id))) {
        const linked = await attachProductsToEntitlement({
          client, path: { ...path, entitlement_id: link.entitlement.id },
          body: { product_ids: [replacement.id] },
        });
        if (linked.error) throw new Error("Could not preserve preview entitlement");
      }
      const affected = packageLinks.filter(link => link.products.some(product => product.id === old.id));
      for (const link of affected) {
        const packagePath = { ...path, package_id: link.pkg.id };
        const detached = await detachProductsFromPackage({ client, path: packagePath, body: { product_ids: [old.id] } });
        if (detached.error) throw new Error("Could not detach old preview product");
        const attached = await attachProductsToPackage({
          client, path: packagePath,
          body: { products: [{ product_id: replacement.id, eligibility_criteria: "all" }] },
        });
        if (attached.error) {
          await attachProductsToPackage({
            client, path: packagePath,
            body: { products: [{ product_id: old.id, eligibility_criteria: "all" }] },
          });
          throw new Error("Could not attach replacement; old preview link restoration requested");
        }
        const verified = await getProductsFromPackage({ client, path: packagePath, query: { limit: 100 } });
        const ids = verified.data?.items.map(item => item.product.id) ?? [];
        if (verified.error || !ids.includes(replacement.id) ||
            link.products.filter(product => product.app_id !== testApp.id).some(product => !ids.includes(product.id)))
          throw new Error("Package verification failed; refusing to delete old preview product");
      }
      const deleted = await deleteProduct({ client, path: { ...path, product_id: old.id } });
      if (deleted.error) {
        const error = deleted.error as { type?: string; message?: string };
        console.warn(`Legacy preview product retained: ${error.type ?? "API refusal"}: ${error.message ?? "deletion not permitted"}`);
      }
    }
    const verified = await readPrices();
    const final = verified.data as Array<{ currency: string; amount_micros: number }>;
    if (verified.error || final.length !== 1 || final[0].currency !== "GBP" || final[0].amount_micros !== plan.amount)
      throw new Error("Final GBP price verification failed");
    console.log(`${plan.label}: verified GBP-only preview price and preserved native package links`);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Preview GBP repair failed");
  process.exitCode = 1;
});
