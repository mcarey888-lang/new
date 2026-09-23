import { createContext, useContext } from "react";

export const AdminKeyContext = createContext<string>("");

export function useAdminKey() {
  return useContext(AdminKeyContext);
}
