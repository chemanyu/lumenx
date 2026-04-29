import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
    sub: string;
    openId: string;
    name: string;
    avatarUrl: string;
    exp: number;
}

interface AuthState {
    token: string | null;
    user: AuthUser | null;
    setToken: (token: string) => void;
    clearAuth: () => void;
    isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            user: null,
            setToken: (token: string) => {
                const payload = JSON.parse(atob(token.split(".")[1]));
                set({ token, user: payload as AuthUser });
            },
            clearAuth: () => set({ token: null, user: null }),
            isAuthenticated: () => {
                const { token, user } = get();
                if (!token || !user) return false;
                return user.exp * 1000 > Date.now();
            },
        }),
        { name: "lumenx-auth" }
    )
);
