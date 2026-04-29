"use client";

import { FolderOpen, Library, Settings, LogOut, Scissors } from "lucide-react";
import clsx from "clsx";
import LumenXBranding from "./LumenXBranding";
import { useAuthStore } from "@/store/authStore";

export type GlobalTab = "workspace" | "library" | "settings" | "video-editor";

interface GlobalSidebarProps {
  activeTab: GlobalTab;
  onTabChange: (tab: GlobalTab) => void;
}

const NAV_ITEMS: { id: GlobalTab; label: string; icon: typeof FolderOpen; hash: string }[] = [
  { id: "workspace", label: "工作区", icon: FolderOpen, hash: "#/" },
  { id: "library", label: "主体库", icon: Library, hash: "#/library" },
  { id: "video-editor", label: "视频编辑", icon: Scissors, hash: "#/video-editor" },
  { id: "settings", label: "设置", icon: Settings, hash: "#/settings" },
];

export default function GlobalSidebar({ activeTab, onTabChange }: GlobalSidebarProps) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const handleNav = (item: (typeof NAV_ITEMS)[number]) => {
    onTabChange(item.id);
    window.location.hash = item.hash;
  };

  const handleLogout = () => {
    clearAuth();
    window.location.hash = "#/login";
  };

  return (
    <aside className="w-56 flex-shrink-0 h-full border-r border-glass-border bg-black/40 backdrop-blur-xl flex flex-col">
      {/* Branding */}
      <div className="p-5 border-b border-glass-border">
        <LumenXBranding size="sm" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative overflow-hidden",
                isActive
                  ? "bg-primary/10 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              {isActive && (
                <div className="absolute left-0 w-1 h-full bg-primary rounded-r" />
              )}
              <Icon size={18} className={isActive ? "text-primary" : ""} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-glass-border space-y-3">
        {user && (
          <div className="flex items-center gap-3 px-1">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-primary font-medium">{user.name?.[0] ?? "?"}</span>
              </div>
            )}
            <span className="text-xs text-gray-300 truncate flex-1">{user.name}</span>
            <button
              onClick={handleLogout}
              title="退出登录"
              className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
        <span className="text-xs text-gray-600 px-1">v0.1.0</span>
      </div>
    </aside>
  );
}
