"use client";

import { useState, useRef } from "react";
import { Upload, Link, Play, Loader2, CheckCircle, XCircle, Plus, X, Trash2, FileVideo } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API_URL } from "@/lib/api";

type TaskStatus = "idle" | "submitting" | "pending" | "running" | "succeeded" | "failed";
type UploadState = "idle" | "uploading" | "done" | "error";

interface EditTask {
  id: string;
  prompt: string;
  videoUrl: string;
  status: TaskStatus;
  resultUrl?: string;
  errorMsg?: string;
  createdAt: number;
}

async function submitEditTask(payload: {
  prompt: string;
  video_url: string;
  reference_image_urls: string[];
  resolution: string;
  watermark: boolean;
  audio_setting: string;
  seed?: number;
}): Promise<string> {
  const res = await axios.post(`${API_URL}/video-edit/tasks`, payload);
  return res.data.task_id;
}

async function pollEditTask(taskId: string): Promise<{
  task_status: string;
  video_url?: string;
  code?: string;
  message?: string;
}> {
  const res = await axios.get(`${API_URL}/video-edit/tasks/${taskId}`);
  return res.data;
}

async function uploadFile(
  endpoint: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  let token: string | null = null;
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("lumenx-auth");
    if (raw) {
      try {
        token = JSON.parse(raw)?.state?.token ?? null;
      } catch {}
    }
  }

  const res = await axios.post(`${API_URL}${endpoint}`, formData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    onUploadProgress: (e) => {
      if (e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data.url as string;
}

interface RefImage {
  id: string;
  state: UploadState;
  progress: number;
  fileName: string;
  url: string;
  error: string;
}

export default function VideoEditor() {
  const [videoInputMode, setVideoInputMode] = useState<"url" | "upload">("url");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const [refImages, setRefImages] = useState<RefImage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState("1080P");
  const [audioSetting, setAudioSetting] = useState("auto");
  const [watermark, setWatermark] = useState(false);
  const [seed, setSeed] = useState<string>("");
  const [tasks, setTasks] = useState<EditTask[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollingRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const updateTask = (id: string, patch: Partial<EditTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const startPolling = (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const data = await pollEditTask(taskId);
        const status = data.task_status.toLowerCase() as TaskStatus;
        if (data.task_status === "SUCCEEDED") {
          updateTask(taskId, { status: "succeeded", resultUrl: data.video_url });
          clearInterval(interval);
          delete pollingRefs.current[taskId];
        } else if (data.task_status === "FAILED") {
          updateTask(taskId, { status: "failed", errorMsg: data.message || data.code || "未知错误" });
          clearInterval(interval);
          delete pollingRefs.current[taskId];
        } else if (data.task_status === "RUNNING") {
          updateTask(taskId, { status: "running" });
        }
      } catch (e) {
        console.error("Poll failed", e);
      }
    }, 15000);
    pollingRefs.current[taskId] = interval;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState("uploading");
    setUploadProgress(0);
    setUploadError("");
    setUploadedFileName(file.name);
    setVideoUrl("");
    try {
      const url = await uploadFile("/video-edit/upload", file, setUploadProgress);
      setVideoUrl(url);
      setUploadState("done");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        "上传失败";
      setUploadError(msg);
      setUploadState("error");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRefImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (refImageInputRef.current) refImageInputRef.current.value = "";

    const newItems: RefImage[] = files.slice(0, 5 - refImages.length).map((f) => ({
      id: Math.random().toString(36).slice(2),
      state: "uploading" as UploadState,
      progress: 0,
      fileName: f.name,
      url: "",
      error: "",
    }));

    setRefImages((prev) => [...prev, ...newItems]);

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const file = files[i];
      try {
        const url = await uploadFile(
          "/video-edit/upload-image",
          file,
          (pct) =>
            setRefImages((prev) =>
              prev.map((r) => (r.id === item.id ? { ...r, progress: pct } : r)),
            ),
        );
        setRefImages((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, state: "done", url } : r)),
        );
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (err as { message?: string })?.message ||
          "上传失败";
        setRefImages((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, state: "error", error: msg } : r)),
        );
      }
    }
  };

  const removeRefImage = (id: string) =>
    setRefImages((prev) => prev.filter((r) => r.id !== id));

  const handleSubmit = async () => {
    if (!prompt.trim() || !videoUrl.trim()) return;
    setIsSubmitting(true);
    try {
      const refUrls = refImages.filter((r) => r.state === "done" && r.url).map((r) => r.url);
      const seedNum = seed.trim() ? parseInt(seed.trim(), 10) : undefined;
      const taskId = await submitEditTask({
        prompt: prompt.trim(),
        video_url: videoUrl.trim(),
        reference_image_urls: refUrls,
        resolution,
        watermark,
        audio_setting: audioSetting,
        seed: seedNum,
      });

      const newTask: EditTask = {
        id: taskId,
        prompt: prompt.trim(),
        videoUrl: videoUrl.trim(),
        status: "pending",
        createdAt: Date.now(),
      };
      setTasks((prev) => [newTask, ...prev]);
      startPolling(taskId);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail || (e as { message?: string })?.message || "提交失败";
      alert(`提交失败：${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeTask = (id: string) => {
    if (pollingRefs.current[id]) {
      clearInterval(pollingRefs.current[id]);
      delete pollingRefs.current[id];
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const canSubmit =
    prompt.trim() &&
    videoUrl.trim() &&
    !isSubmitting &&
    refImages.every((r) => r.state !== "uploading");

  return (
    <div className="flex h-full w-full gap-6 p-6 overflow-hidden">
      {/* Left panel — input form */}
      <div className="w-96 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
        <div>
          <h2 className="text-xl font-display font-bold text-white mb-1">视频编辑</h2>
          <p className="text-xs text-gray-400">HappyHorse · 风格变换 / 局部替换</p>
        </div>

        {/* Video source */}
        <div className="glass-panel rounded-xl p-4 space-y-3">
          <label className="text-sm font-medium text-gray-300">待编辑视频</label>
          <div className="flex gap-2">
            <button
              onClick={() => { setVideoInputMode("url"); setVideoUrl(""); setUploadState("idle"); setUploadedFileName(""); setUploadError(""); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                videoInputMode === "url"
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-white/5 text-gray-400 border border-transparent hover:bg-white/10"
              }`}
            >
              <Link size={12} className="inline mr-1" />
              URL
            </button>
            <button
              onClick={() => { setVideoInputMode("upload"); setVideoUrl(""); setUploadState("idle"); setUploadedFileName(""); setUploadError(""); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                videoInputMode === "upload"
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-white/5 text-gray-400 border border-transparent hover:bg-white/10"
              }`}
            >
              <Upload size={12} className="inline mr-1" />
              本地上传
            </button>
          </div>

          {videoInputMode === "url" ? (
            <>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://xxx.mp4（MP4/MOV，3~60s，≤100MB）"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
              />
              <p className="text-[11px] text-gray-500">仅支持公网可访问的 HTTP/HTTPS URL</p>
            </>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.mov,video/mp4,video/quicktime"
                className="hidden"
                onChange={handleFileChange}
              />
              {uploadState === "idle" && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 rounded-lg border-2 border-dashed border-gray-600 hover:border-primary/60 bg-white/[0.02] hover:bg-white/5 transition-colors flex flex-col items-center gap-2"
                >
                  <FileVideo size={24} className="text-gray-500" />
                  <span className="text-sm text-gray-400">点击选择视频文件</span>
                  <span className="text-[11px] text-gray-600">MP4 / MOV · 3~60 秒 · ≤100MB</span>
                </button>
              )}
              {uploadState === "uploading" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="truncate">上传中：{uploadedFileName}</span>
                    <span className="ml-auto flex-shrink-0">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {uploadState === "done" && (
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                  <span className="text-green-400 truncate flex-1">{uploadedFileName}</span>
                  <button
                    onClick={() => { setUploadState("idle"); setVideoUrl(""); setUploadedFileName(""); }}
                    className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {uploadState === "error" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <XCircle size={14} className="flex-shrink-0" />
                    <span className="flex-1">{uploadError}</span>
                  </div>
                  <button
                    onClick={() => { setUploadState("idle"); setUploadError(""); fileInputRef.current?.click(); }}
                    className="text-xs text-primary hover:underline"
                  >
                    重新选择
                  </button>
                </div>
              )}
              <p className="text-[11px] text-gray-500">上传至 OSS，生成签名 URL 供模型访问</p>
            </>
          )}
        </div>

        {/* Reference images */}
        <div className="glass-panel rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">
              参考图（可选，最多5张）
            </label>
            {refImages.length < 5 && (
              <button
                onClick={() => refImageInputRef.current?.click()}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <Plus size={12} />
                添加
              </button>
            )}
          </div>

          <input
            ref={refImageInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleRefImageChange}
          />

          {refImages.length === 0 ? (
            <button
              onClick={() => refImageInputRef.current?.click()}
              className="w-full py-4 rounded-lg border-2 border-dashed border-gray-600 hover:border-primary/60 bg-white/[0.02] hover:bg-white/5 transition-colors flex flex-col items-center gap-1.5"
            >
              <Upload size={18} className="text-gray-500" />
              <span className="text-xs text-gray-400">点击上传参考图</span>
            </button>
          ) : (
            <div className="space-y-2">
              {refImages.map((img) => (
                <div key={img.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  {img.state === "uploading" && (
                    <Loader2 size={13} className="animate-spin text-primary flex-shrink-0" />
                  )}
                  {img.state === "done" && (
                    <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                  )}
                  {img.state === "error" && (
                    <XCircle size={13} className="text-red-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{img.fileName}</p>
                    {img.state === "uploading" && (
                      <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                        <div
                          className="bg-primary h-1 rounded-full transition-all"
                          style={{ width: `${img.progress}%` }}
                        />
                      </div>
                    )}
                    {img.state === "error" && (
                      <p className="text-[10px] text-red-400 truncate">{img.error}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeRefImage(img.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-500">JPEG / PNG / WEBP · ≥300px · ≤10MB</p>
        </div>

        {/* Prompt */}
        <div className="glass-panel rounded-xl p-4 space-y-2">
          <label className="text-sm font-medium text-gray-300">编辑指令 *</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述对视频的编辑意图，例如：让视频中的角色穿上图片中的条纹毛衣"
            rows={4}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors resize-none"
          />
        </div>

        {/* Parameters */}
        <div className="glass-panel rounded-xl p-4 space-y-3">
          <label className="text-sm font-medium text-gray-300">生成参数</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">分辨率</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
              >
                <option value="1080P">1080P</option>
                <option value="720P">720P</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">声音处理</label>
              <select
                value={audioSetting}
                onChange={(e) => setAudioSetting(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
              >
                <option value="auto">自动</option>
                <option value="origin">保留原声</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">随机种子（可选，0~2147483647）</label>
            <input
              type="number"
              min={0}
              max={2147483647}
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="留空则随机"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={watermark}
              onChange={(e) => setWatermark(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-300">添加水印</span>
          </label>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <Play size={16} />
              开始编辑
            </>
          )}
        </button>
      </div>

      {/* Right panel — task list */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Play size={48} className="text-gray-600 mb-4" />
            <p className="text-gray-400 text-sm">提交任务后，结果将在这里显示</p>
            <p className="text-gray-600 text-xs mt-1">视频编辑通常需要 1–5 分钟，页面会自动轮询</p>
          </div>
        ) : (
          <AnimatePresence>
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-panel rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium line-clamp-2">{task.prompt}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{task.videoUrl}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={task.status} />
                    <button
                      onClick={() => removeTask(task.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {task.status === "succeeded" && task.resultUrl && (
                  <div className="space-y-2">
                    <video
                      src={task.resultUrl}
                      controls
                      className="w-full rounded-lg max-h-64 bg-black"
                    />
                    <a
                      href={task.resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Play size={12} />
                      在新标签页打开 · 链接24小时有效
                    </a>
                  </div>
                )}

                {task.status === "failed" && (
                  <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                    失败：{task.errorMsg}
                  </p>
                )}

                {(task.status === "pending" || task.status === "running") && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span>{task.status === "pending" ? "排队中..." : "生成中，请稍候（约1–5分钟）..."}</span>
                  </div>
                )}

                <p className="text-[11px] text-gray-600">
                  任务 ID: {task.id} · {new Date(task.createdAt).toLocaleTimeString("zh-CN")}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    idle: { label: "空闲", cls: "bg-gray-500/20 text-gray-400", icon: null },
    submitting: { label: "提交中", cls: "bg-blue-500/20 text-blue-400", icon: <Loader2 size={10} className="animate-spin" /> },
    pending: { label: "排队中", cls: "bg-yellow-500/20 text-yellow-400", icon: <Loader2 size={10} className="animate-spin" /> },
    running: { label: "生成中", cls: "bg-blue-500/20 text-blue-400", icon: <Loader2 size={10} className="animate-spin" /> },
    succeeded: { label: "完成", cls: "bg-green-500/20 text-green-400", icon: <CheckCircle size={10} /> },
    failed: { label: "失败", cls: "bg-red-500/20 text-red-400", icon: <XCircle size={10} /> },
  };
  const { label, cls, icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {icon}
      {label}
    </span>
  );
}
