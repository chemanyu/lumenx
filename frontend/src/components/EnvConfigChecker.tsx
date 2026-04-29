"use client";

import { useState, useEffect } from "react";
import EnvConfigDialog from "@/components/project/EnvConfigDialog";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function EnvConfigChecker() {
  const [isEnvDialogOpen, setIsEnvDialogOpen] = useState(false);
  const [envRequired, setEnvRequired] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    // 只在客户端执行、只检查一次、且已登录后才请求
    if (typeof window === 'undefined' || hasChecked) return;
    if (!isAuthenticated()) return;

    checkEnvConfig();
    setHasChecked(true);
  }, [hasChecked, token, isAuthenticated]);

  const checkEnvConfig = async () => {
    try {
      const config = await api.getEnvConfig();
      // 空值和空字符串都视为未配置
      const dashscopeKey = config.DASHSCOPE_API_KEY?.trim();
      const hasRequired = dashscopeKey && dashscopeKey.length > 0;
      
      if (!hasRequired) {
        setEnvRequired(true);
        setIsEnvDialogOpen(true);
      }
    } catch (error: any) {
      // 401 表示未登录，忽略（AuthGuard 会处理跳转）
      if (error?.response?.status === 401) return;
      console.error("Failed to check env config:", error);
      setEnvRequired(true);
      setIsEnvDialogOpen(true);
    }
  };

  return (
    <EnvConfigDialog
      isOpen={isEnvDialogOpen}
      onClose={() => {
        setIsEnvDialogOpen(false);
        setEnvRequired(false);
      }}
      isRequired={envRequired}
    />
  );
}
