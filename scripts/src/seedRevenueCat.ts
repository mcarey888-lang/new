import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "Summit Ready";

// Monthly product
const MONTHLY_IDENTIFIER = "summit_ready_premium_monthly";
const MONTHLY_PLAY_IDENTIFIER = "summit_ready_premium_monthly:monthly";
const MONTHLY_DISPLAY_NAME = "Summit Ready Pro Monthly";
const MONTHLY_USER_TITLE = "Summit Ready Pro Monthly";

// Annual product
const ANNUAL_IDENTIFIER = "summit_ready_premium_annual";
const ANNUAL_PLAY_IDENTIFIER = "summit_ready_premium_annual:annual";
const ANNUAL_DISPLAY_NAME = "Summit Ready Pro Annual";
const ANNUAL_USER_TITLE = "Summit Ready Pro Annual";

const APP_STORE_APP_NAME = "Summit Ready iOS";
const APP_STORE_BUNDLE_ID = "com.summitready.app";
const PLAY_STORE_APP_NAME = "Summit Ready Android";
const PLAY_STORE_PACKAGE_NAME = "com.summitready.app";

const ENTITLEMENT_IDENTIFIER = "premium";
const ENTITLEMENT_DISPLAY_NAME = "Premium Access";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

const MONTHLY_PACKAGE_IDENTIFIER = "$rc_monthly";
const MONTHLY_PACKAGE_DISPLAY_NAME = "Monthly Subscription";

const ANNUAL_PACKAGE_IDENTIFIER = "$rc_annual";
const ANNUAL_PACKAGE_DISPLAY_NAME = "Annual Subscription";

// £9.99/month → GBP + USD equivalent
const MONTHLY_PRICES = [
  { amount_micros: 9990000, currency: "GBP" },  // £9.99
  { amount_micros: 12990000, currency: "USD" }, // $12.99
  { amount_micros: 10990000, currency: "EUR" }, // €10.99
];

// £59/year → GBP + USD equivalent
const ANNUAL_PRICES = [
  { amount_micros: 59000000, currency: "GBP" },  // £59.00
  { amount_micros: 74990000, currency: "USD" },  // $74.99
  { amount_micros: 65990000, currency: "EUR" },  // €65.99
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  // ── Project ──────────────────────────────────────────────────────────────────
  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });

  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);

  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error: createProjectError } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (createProjectError) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  // ── Apps ─────────────────────────────────────────────────────────────────────
  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listAppsError || !apps || apps.items.length === 0) throw new Error("No apps found");

  let testApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!testApp) throw new Error("No test store app found");
  console.log("Test store app:", testApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: APP_STORE_APP_NAME, type: "app_store", app_store: { bundle_id: APP_STORE_BUNDLE_ID } },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: PLAY_STORE_APP_NAME, type: "play_store", play_store: { package_name: PLAY_STORE_PACKAGE_NAME } },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app:", playStoreApp.id);
  }

  // ── Products ─────────────────────────────────────────────────────────────────
  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });

  if (listProductsError) throw new Error("Failed to list products");

  const ensureProduct = async (
    targetApp: App,
    label: string,
    storeId: string,
    displayName: string,
    userTitle: string,
    duration: "P1M" | "P1Y",
    isTestStore: boolean
  ): Promise<Product> => {
    const existing = existingProducts.items?.find(
      (p) => p.store_identifier === storeId && p.app_id === targetApp.id
    );
    if (existing) {
      console.log(label + " product already exists:", existing.id);
      return existing;
    }

    const body: CreateProductData["body"] = {
      store_identifier: storeId,
      app_id: targetApp.id,
      type: "subscription",
      display_name: displayName,
    };

    if (isTestStore) {
      body.subscription = { duration };
      body.title = userTitle;
    }

    const { data: created, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });

    if (error) throw new Error("Failed to create " + label + " product");
    console.log("Created " + label + " product:", created.id);
    return created;
  };

  const testMonthly   = await ensureProduct(testApp, "Test/Monthly",    MONTHLY_IDENTIFIER,      MONTHLY_DISPLAY_NAME, MONTHLY_USER_TITLE, "P1M", true);
  const iosMonthly    = await ensureProduct(appStoreApp, "iOS/Monthly",  MONTHLY_IDENTIFIER,      MONTHLY_DISPLAY_NAME, MONTHLY_USER_TITLE, "P1M", false);
  const androidMonthly = await ensureProduct(playStoreApp, "Android/Monthly", MONTHLY_PLAY_IDENTIFIER, MONTHLY_DISPLAY_NAME, MONTHLY_USER_TITLE, "P1M", false);

  const testAnnual    = await ensureProduct(testApp, "Test/Annual",      ANNUAL_IDENTIFIER,       ANNUAL_DISPLAY_NAME,  ANNUAL_USER_TITLE,  "P1Y", true);
  const iosAnnual     = await ensureProduct(appStoreApp, "iOS/Annual",   ANNUAL_IDENTIFIER,       ANNUAL_DISPLAY_NAME,  ANNUAL_USER_TITLE,  "P1Y", false);
  const androidAnnual = await ensureProduct(playStoreApp, "Android/Annual", ANNUAL_PLAY_IDENTIFIER, ANNUAL_DISPLAY_NAME, ANNUAL_USER_TITLE, "P1Y", false);

  // ── Test-store prices ─────────────────────────────────────────────────────────
  const setTestPrices = async (productId: string, prices: typeof MONTHLY_PRICES, label: string) => {
    const { error } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: productId },
      body: { prices },
    });
    if (error) {
      if (typeof error === "object" && "type" in error && (error as any).type === "resource_already_exists") {
        console.log(label + " prices already exist");
      } else {
        throw new Error("Failed to set prices for " + label);
      }
    } else {
      console.log("Set prices for " + label);
    }
  };

  await setTestPrices(testMonthly.id, MONTHLY_PRICES, "monthly");
  await setTestPrices(testAnnual.id,  ANNUAL_PRICES,  "annual");

  // ── Entitlement ───────────────────────────────────────────────────────────────
  let entitlement: Entitlement | undefined;
  const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  const existingEntitlement = existingEntitlements.items?.find(
    (e) => e.lookup_key === ENTITLEMENT_IDENTIFIER
  );

  if (existingEntitlement) {
    console.log("Entitlement already exists:", existingEntitlement.id);
    entitlement = existingEntitlement;
  } else {
    const { data: newEntitlement, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: ENTITLEMENT_IDENTIFIER, display_name: ENTITLEMENT_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create entitlement");
    console.log("Created entitlement:", newEntitlement.id);
    entitlement = newEntitlement;
  }

  const { error: attachEntErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: {
      product_ids: [testMonthly.id, iosMonthly.id, androidMonthly.id, testAnnual.id, iosAnnual.id, androidAnnual.id],
    },
  });

  if (attachEntErr) {
    if ((attachEntErr as any).type === "unprocessable_entity_error") {
      console.log("Products already attached to entitlement");
    } else {
      throw new Error("Failed to attach products to entitlement");
    }
  } else {
    console.log("Attached all products to entitlement");
  }

  // ── Offering ──────────────────────────────────────────────────────────────────
  let offering: Offering | undefined;
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listOfferingsError) throw new Error("Failed to list offerings");

  const existingOffering = existingOfferings.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER);

  if (existingOffering) {
    console.log("Offering already exists:", existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOffering, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create offering");
    console.log("Created offering:", newOffering.id);
    offering = newOffering;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Set offering as current");
  }

  // ── Packages ──────────────────────────────────────────────────────────────────
  const { data: existingPackages, error: listPackagesError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });

  if (listPackagesError) throw new Error("Failed to list packages");

  const ensurePackage = async (lookupKey: string, displayName: string): Promise<Package> => {
    const existing = existingPackages.items?.find((p) => p.lookup_key === lookupKey);
    if (existing) {
      console.log(displayName + " package already exists:", existing.id);
      return existing;
    }
    const { data: created, error } = await createPackages({
      client,
      path: { project_id: project.id, offering_id: offering!.id },
      body: { lookup_key: lookupKey, display_name: displayName },
    });
    if (error) throw new Error("Failed to create package " + lookupKey);
    console.log("Created package " + displayName + ":", created.id);
    return created;
  };

  const monthlyPkg = await ensurePackage(MONTHLY_PACKAGE_IDENTIFIER, MONTHLY_PACKAGE_DISPLAY_NAME);
  const annualPkg  = await ensurePackage(ANNUAL_PACKAGE_IDENTIFIER,  ANNUAL_PACKAGE_DISPLAY_NAME);

  const attachPkg = async (pkg: Package, products: Product[], label: string) => {
    const { error } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: products.map((p) => ({ product_id: p.id, eligibility_criteria: "all" as const })),
      },
    });
    if (error) {
      if ((error as any).type === "unprocessable_entity_error") {
        console.log(label + " products already attached");
      } else {
        throw new Error("Failed to attach products to " + label);
      }
    } else {
      console.log("Attached products to " + label);
    }
  };

  await attachPkg(monthlyPkg, [testMonthly, iosMonthly, androidMonthly], "monthly package");
  await attachPkg(annualPkg,  [testAnnual, iosAnnual, androidAnnual],   "annual package");

  // ── API Keys ──────────────────────────────────────────────────────────────────
  const { data: testKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: testApp.id } });
  const { data: iosKeys }  = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: appStoreApp.id } });
  const { data: droidKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: playStoreApp.id } });

  console.log("\n====================");
  console.log("Summit Ready — RevenueCat setup complete!");
  console.log("Project ID:", project.id);
  console.log("Test Store App ID:", testApp.id);
  console.log("App Store App ID:", appStoreApp.id);
  console.log("Play Store App ID:", playStoreApp.id);
  console.log("Entitlement Identifier:", ENTITLEMENT_IDENTIFIER);
  console.log("\nSet these environment variables:");
  console.log("REVENUECAT_PROJECT_ID=" + project.id);
  console.log("REVENUECAT_TEST_STORE_APP_ID=" + testApp.id);
  console.log("REVENUECAT_APPLE_APP_STORE_APP_ID=" + appStoreApp.id);
  console.log("REVENUECAT_GOOGLE_PLAY_STORE_APP_ID=" + playStoreApp.id);
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=" + (testKeys?.items?.[0]?.key ?? "N/A"));
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=" + (iosKeys?.items?.[0]?.key ?? "N/A"));
  console.log("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=" + (droidKeys?.items?.[0]?.key ?? "N/A"));
  console.log("====================\n");
}

seedRevenueCat().catch(console.error);
