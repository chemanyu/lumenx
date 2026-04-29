"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const token = useAuthStore((s) => s.token);
    // 等待 zustand persist 从 localStorage 恢复完成后再做鉴权判断
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        if (typeof window === "undefined") return;
        if (window.location.hash.startsWith("#/login")) return;
        if (!isAuthenticated()) {
            window.location.hash = "#/login";
        }
    }, [hydrated, token, isAuthenticated]);

    return <>{children}</>;
}
