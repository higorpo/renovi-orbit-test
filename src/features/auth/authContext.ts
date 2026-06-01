import { createContext } from "react";
import type { AuthContextType } from "./types/auth.types";

/** Isolated context module so Vite HMR does not recreate the provider/hook pair. */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
