"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthSession, User } from "./types";
import { authApi } from "./api/services";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  getActiveBranchId,
  setActiveBranchId,
} from "./api/auth-storage";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    identifier: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setSession: (session: AuthSession) => void;
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      setSession: (session) => {
        setAccessToken(session.accessToken);
        set({
          user: session.user,
          accessToken: session.accessToken,
          isAuthenticated: true,
        });
      },

      bootstrap: async () => {
        const token = getAccessToken();
        if (!token) {
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
          });
          return;
        }

        set({ isLoading: true });
        try {
          const user = await authApi.me();
          // Ensure we have an active branch ID
          if (!getActiveBranchId()) {
            try {
              // Attempt to fetch branches and set the first one as active
              const { branchesApi } = await import("./api/services");
              const branchesRes = await branchesApi.list({ page: 1, limit: 1 });
              if (branchesRes.data && branchesRes.data.length > 0 && typeof branchesRes.data[0].id === 'string') {
                setActiveBranchId(branchesRes.data[0].id);
              }
            } catch (err) {
              console.warn("Could not auto-set branch id", err);
            }
          }

          set({
            user,
            accessToken: token,
            isAuthenticated: true,
          });
        } catch {
          clearAccessToken();
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      login: async (identifier, password) => {
        try {
          set({ isLoading: true });
          const session = await authApi.login({ identifier, password });

          get().setSession(session);

          // Ensure active branch is set post login
          if (!getActiveBranchId()) {
            try {
              const { branchesApi } = await import("./api/services");
              const branchesRes = await branchesApi.list({ page: 1, limit: 1 });
              if (branchesRes.data && branchesRes.data.length > 0 && typeof branchesRes.data[0].id === 'string') {
                setActiveBranchId(branchesRes.data[0].id);
              }
            } catch (err) {
              console.warn("Could not auto-set branch id on login", err);
            }
          }

          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Login muvaffaqiyatsiz tugadi";
          set({ isLoading: false });
          return { success: false, error: message };
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // no-op
        } finally {
          clearAccessToken();
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: "academy-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
