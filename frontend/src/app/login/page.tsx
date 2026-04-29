"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
    const setToken = useAuthStore((s) => s.setToken);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const hash = window.location.hash;
        const queryStr = hash.includes("?") ? hash.split("?")[1] : "";
        const params = new URLSearchParams(queryStr);
        const token = params.get("token");
        const err = params.get("error");

        if (token) {
            setToken(token);
            // 用 replace 跳转让页面重新初始化，触发数据加载
            window.location.replace(window.location.origin + "/#/");
            return;
        }

        if (err) {
            setError("钉钉登录失败，请重试");
        }
    }, [setToken]);

    const handleLogin = async () => {
        setLoading(true);
        setError("");
        try {
            const frontendOrigin = window.location.origin;
            const res = await fetch(`${API_URL}/auth/login?frontend_origin=${encodeURIComponent(frontendOrigin)}`);
            if (!res.ok) throw new Error("获取登录链接失败");
            const data = await res.json();
            window.location.href = data.url;
        } catch (e) {
            setError("网络错误，请检查后端是否启动");
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-background">
            <div className="w-full max-w-sm mx-4 p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl flex flex-col items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                    <div className="text-3xl font-bold tracking-tight text-foreground">LumenX Studio</div>
                    <div className="text-sm text-foreground/50">AI 动漫创作平台</div>
                </div>

                {error && (
                    <div className="w-full px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-medium transition-all
                               bg-primary/90 hover:bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed
                               shadow-lg shadow-primary/20"
                >
                    {loading ? (
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 7.5h-3v1.5h3V13h-3v1.5h3V16h-4.5V8H16.5v1.5zm-6 0H7.5v7H9v-7h1.5V8H7.5v1.5z" />
                        </svg>
                    )}
                    使用钉钉扫码登录
                </button>

                <p className="text-xs text-foreground/30 text-center">
                    打开钉钉 APP 扫描二维码完成授权
                </p>
            </div>
        </div>
    );
}
