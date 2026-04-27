#!/bin/bash

# 阿里云服务不走代理（避免PAC配置被Python忽略）
export NO_PROXY="*.aliyuncs.com,localhost,127.0.0.1"
export no_proxy="*.aliyuncs.com,localhost,127.0.0.1"

# 日志文件路径
LOG_FILE="$(dirname "$0")/logs/backend.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "========================================"
echo "Starting Backend (FastAPI)..."
echo "Port: 17177"
echo "Proxy Bypass: *.aliyuncs.com"
echo "Log: $LOG_FILE"
echo "========================================"

# 确保在项目根目录
cd "$(dirname "$0")"

# 启动 uvicorn，日志同时输出到终端和文件
python3 -m uvicorn src.apps.comic_gen.api:app --reload --port 17177 --host 0.0.0.0 2>&1 | tee -a "$LOG_FILE"
