export function encodeAdminKey(value: string): string {
  const bytes = new TextEncoder().encode(value.trim());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function adminKeyHeader(value: string): Record<string, string> {
  return value.trim() ? { "x-vx-admin-key-b64": encodeAdminKey(value) } : {};
}