# LumenX Studio 使用指南

> AI 驱动的动态漫画创作平台 —— 将小说文本自动转化为动态视频

---

## 目录

- [项目简介](#项目简介)
- [技术架构](#技术架构)
- [环境准备](#环境准备)
- [快速启动](#快速启动)
- [完整创作流程](#完整创作流程)
- [AI 模型说明](#ai-模型说明)
- [配置说明](#配置说明)
- [高级功能](#高级功能)
- [常见问题](#常见问题)

---

## 项目简介

LumenX Studio 是一个 AI 原生的动态漫画创作平台，核心能力是将小说文本自动分析、生成角色资产、绘制分镜、生成视频并最终合成完整影片。

**完整流程**：小说文本 → 剧本解析 → 美术风格 → 角色/场景资产 → 分镜 → 视频生成 → 音频 → 合成导出

---

## 技术架构

| 层次 | 技术栈 |
|------|--------|
| 前端 | Next.js 14 + React 18 + TypeScript + Tailwind CSS |
| 后端 | FastAPI + Python 3.11+ |
| 状态管理 | Zustand |
| 视频处理 | FFmpeg |
| LLM | 阿里云通义千问（DashScope），支持接入 OpenAI 兼容接口 |
| 图像生成 | 万象（Wanx）T2I/I2I |
| 视频生成 | 万象 I2V/R2V、可灵（Kling）、Vidu |
| 语音合成 | CosyVoice（DashScope） |
| 存储 | 本地 `output/` 目录，可选 Alibaba Cloud OSS |

---

## 环境准备

### 依赖要求

- Python 3.11+
- Node.js 18+
- FFmpeg（用于视频合并，启动时自动检测，缺失会给出安装提示）

### API Key 准备

**必须**：
- `DASHSCOPE_API_KEY`：阿里云 DashScope API Key，用于通义千问、万象图像/视频、CosyVoice 语音

**可选**：
- `KLING_ACCESS_KEY` / `KLING_SECRET_KEY`：直连可灵 API
- `VIDU_API_KEY`：直连 Vidu API
- 阿里云 OSS 相关配置：用于云端存储媒体文件

---

## 快速启动

### 1. 克隆项目并安装依赖

```bash
# 安装 Python 依赖
pip install -r requirements.txt

# 安装前端依赖
cd frontend && npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少填写：

```bash
DASHSCOPE_API_KEY=your_dashscope_api_key_here
```

### 3. 启动后端

```bash
./start_backend.sh
# 或手动启动：
uvicorn src.apps.comic_gen.api:app --reload --port 8000 --host 0.0.0.0
```

后端地址：`http://localhost:8000`
API 文档：`http://localhost:8000/docs`

### 4. 启动前端

```bash
cd frontend && npm run dev
```

前端地址：`http://localhost:3000`

---

## 完整创作流程

LumenX 的创作流程分为 9 个步骤，在左侧导航栏依次进行。

---

### Step 1 · Script（剧本）

**目标**：上传小说文本，AI 自动提取角色、场景、道具信息。

**操作**：
1. 新建项目，粘贴或上传小说文本
2. 点击"解析剧本"，LLM 自动识别并提取：
   - **角色**：姓名、外貌描述、年龄、性别、服装
   - **场景**：地点、时间、光线氛围
   - **道具**：关键物品
3. 可在界面手动修改提取结果

> 依赖：`DASHSCOPE_API_KEY`（调用通义千问）

---

### Step 2 · Art Direction（美术指导）

**目标**：定义整部作品的统一视觉风格。

**操作**：
1. 点击"获取 AI 推荐"，通义千问根据剧本内容推荐风格
2. 或从 30+ 内置风格预设中选择（电影感、漫画、水彩等）
3. 也可自定义正向/负向提示词

> 此处设定的风格会应用于后续所有图像和视频生成。

---

### Step 3 · Assets（资产）

**目标**：为每个角色、场景、道具生成参考图片（和可选的参考视频）。

**操作**：
1. 在角色/场景/道具列表中，点击"生成"
2. 角色生成分三个层次：
   - **全身像**（主图，无背景）→ T2I
   - **三视图**（多角度转身）→ I2I，基于全身像
   - **头像/特写**→ I2I，基于全身像
3. 每次可生成多个变体，选择最满意的收藏（锁定）
4. 可选：生成**动态参考视频**（Motion Reference），用于后续 R2V 驱动模式

> 角色、场景、道具均可单独重新生成，已收藏的变体不会被覆盖。

---

### Step 4 · Storyboard（分镜）

**目标**：将剧情划分为一帧一帧的分镜画面，并为每帧生成参考图。

**操作**：
1. 点击"生成分镜"，AI 自动从剧本提取分镜描述
2. 每个分镜包含：
   - 引用的场景、角色、道具
   - 镜头信息（景别、角度、运镜方式）
   - 视觉描述（氛围、角色表演、动作物理）
   - 台词与说话人
3. 可手动新增、删除、调整分镜顺序
4. 点击"AI 润色"优化提示词后，为每帧生成参考图

---

### Step 5 · Motion（运动）

**目标**：为每个分镜生成视频片段。

**两种生成模式**：

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **I2V（首帧驱动）** | 以分镜参考图为首帧，生成动态视频 | 有清晰的画面构图 |
| **R2V（参考驱动）** | 以 Step 3 生成的动态参考视频驱动角色/场景运动 | 需要特定动作或角色一致性 |

**操作**：
1. 选择生成模式（界面顶部切换 I2V / R2V）
2. 选择对应的参考图或参考视频
3. 输入提示词，描述画面中的运动内容
   - 可使用"运镜"按钮插入运镜指令
   - 可使用"AI 润色"优化提示词
4. 右侧调整参数：模型、时长、镜头类型
5. 点击生成，等待任务完成
6. 每帧支持生成多个变体，选择最满意的作为该帧最终视频

**支持的视频模型**（右侧 Model 下拉选择）：

| 模型 | 说明 |
|------|------|
| Wan 2.6 I2V | 默认，最新万象模型 |
| Wan 2.6 I2V Flash | 快速生成版 |
| Wan 2.5 I2V Preview | 经典版本 |
| Kling v3 | 可灵最新模型 |
| Vidu Q3 Pro | Vidu 最新模型 |
| Vidu Q3 Turbo | Vidu 快速版 |

---

### Step 6 · Assembly（组装）

**目标**：将所有分镜视频合并成完整影片。

**操作**：
1. 确认每帧都已选定视频变体
2. 点击"合并视频"
3. 系统调用 FFmpeg 按分镜顺序拼接所有片段

> 需要提前安装 FFmpeg。合并前请确保每帧均有状态为 `completed` 的视频。

---

### Step 7 · Voice（配音）Beta

**目标**：为每个分镜的台词生成语音。

**操作**：
1. 在角色设置中绑定声音（从 CosyVoice 40+ 音色中选择）
2. 为每帧台词生成 TTS 音频
3. 支持调节语速（0.5x～2.0x）

---

### Step 8 · Final Mix（最终混音）Beta

**目标**：混合视频、对话音频、音效、背景音乐。不会吧哥哥吧 吧 vggbgbhb

---

### Step 9 · Export（导出）Beta

**目标**：导出最终成片。

支持导出到本地文件或 Alibaba Cloud OSS。

---

## AI 模型说明

### LLM（文本理解与生成）

默认使用通义千问（DashScope），通过 OpenAI 兼容接口调用，无需额外安装 OpenAI SDK 以外的依赖。

如需切换到其他 LLM，在 `.env` 中配置：

```bash
# 切换到 OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# 切换到 DeepSeek
LLM_PROVIDER=openai
OPENAI_API_KEY=your_deepseek_key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat

# 本地 Ollama
LLM_PROVIDER=openai
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=qwen2.5:72b
```

### 视频模型路由

Kling 和 Vidu 默认通过 DashScope 统一路由。如需直连官方 API：

```bash
# 直连可灵
KLING_PROVIDER_MODE=vendor
KLING_ACCESS_KEY=your_key
KLING_SECRET_KEY=your_secret

# 直连 Vidu
VIDU_PROVIDER_MODE=vendor
VIDU_API_KEY=your_key
```

---

## 配置说明

### 完整 `.env` 配置项

```bash
# ===== 必填 =====
DASHSCOPE_API_KEY=                    # DashScope API Key

# ===== 可选：阿里云 OSS =====
ALIBABA_CLOUD_ACCESS_KEY_ID=
ALIBABA_CLOUD_ACCESS_KEY_SECRET=
OSS_BUCKET_NAME=
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
OSS_BASE_PATH=comic_gen/

# ===== 可选：第三方视频模型 =====
KLING_ACCESS_KEY=
KLING_SECRET_KEY=
VIDU_API_KEY=

# ===== 可选：自定义 LLM =====
LLM_PROVIDER=dashscope               # 或 openai
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=

# ===== 服务配置 =====
API_HOST=0.0.0.0
API_PORT=8000

# ===== 供应商路由模式 =====
KLING_PROVIDER_MODE=dashscope        # dashscope | vendor
VIDU_PROVIDER_MODE=dashscope         # dashscope | vendor
PIXVERSE_PROVIDER_MODE=dashscope     # dashscope | vendor
```

### 数据存储

所有生成内容默认保存在 `output/` 目录：

```
output/
├── projects.json       # 所有项目数据
├── series.json         # 所有系列数据
├── uploads/            # 用户上传文件
├── assets/             # 生成的角色/场景/道具图片
├── storyboard/         # 分镜参考图
├── video/              # 生成的视频片段
└── video_inputs/       # 中间处理文件
```

---

## 高级功能

### 系列管理（Series）

适用于多集作品（如小说各章节）：
- 创建系列后可添加多个剧集（Episode）
- 系列级别共享角色/场景资产库
- 各剧集继承系列风格和模型设置，也可单独覆盖
- 支持大文本导入并由 LLM 自动切分为各集

### 多变体生成（抽卡机制）

- 每次生成支持批量输出多个变体
- 可收藏（锁定）满意的变体，防止被后续生成覆盖
- 最终选定某个变体作为该分镜/资产的正式版本

### 提示词润色

系统在三个阶段提供 AI 提示词优化：
1. **分镜提示词**：用于图像生成
2. **I2V 提示词**：用于首帧驱动视频生成
3. **R2V 提示词**：用于参考驱动视频生成

每个项目/系列可配置自定义润色规则（PromptConfig）。

---

## 常见问题

### 报错：`openai package not installed`

```bash
pip install openai>=1.0.0
```

### 报错：`DashScope HTTP 403 AccessDenied`（OSS 上传失败）

通常是 OSS 表单字段缺失，已在代码中修复（`x-oss-object-acl`、`x-oss-forbid-overwrite` 自动从 Policy 响应中映射）。重启后端重试。

### 报错：`No videos selected to merge`

合并前需要确保每个分镜都已生成并选定了视频变体（状态为 `completed`）。请先完成 Step 5 Motion 的视频生成。

### 报错：`FFmpeg not found`

安装 FFmpeg：
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
apt install ffmpeg
```

### 重启后端数据会丢失吗？

不会。项目数据保存在 `output/projects.json`，已生成的图片/视频保存在 `output/` 对应目录，重启不影响。
正在生成中的任务（`pending`/`processing`）会中断，需要重新触发。
