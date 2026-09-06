export async function loadPurchases() {
  const purchasesModule = await import("react-native-purchases");
  return purchasesModule.default;
}