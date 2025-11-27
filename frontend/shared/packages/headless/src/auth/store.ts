import { create } from "zustand";

interface AuthState {
  tokens: { accessToken: string; refreshToken?: string } | null;
  user: { tenantId?: string } | null;
  isAuthenticated: boolean;
  refreshToken: () => Promise<{ accessToken: string; refreshToken?: string } | null>;
}

const useAuthStore = create<AuthState>(() => ({
  tokens: null,
  user: null,
  isAuthenticated: false,
  refreshToken: async () => null,
}));

export { useAuthStore };
