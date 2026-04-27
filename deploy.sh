#!/bin/bash
set -e

SERVER="root@172.16.3.34"
REMOTE_DIR="/data/lumenx"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

# Parse flags
SKIP_FRONTEND=false
SKIP_BACKEND=false
for arg in "$@"; do
  case $arg in
    --no-frontend) SKIP_FRONTEND=true ;;
    --no-backend)  SKIP_BACKEND=true ;;
  esac
done

echo "=== [1/4] 同步代码 ==="
rsync -avz --exclude='.venv' --exclude='node_modules' --exclude='output' --exclude='.git' \
  "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"

if [ "$SKIP_FRONTEND" = false ]; then
  echo "=== [2/4] 构建前端 ==="
  cd "$LOCAL_DIR/frontend"
  DOCKER_BUILD=true npm run build

  echo "=== [3/4] 推送前端产物 ==="
  rsync -avz --delete "$LOCAL_DIR/frontend/out/" "$SERVER:$REMOTE_DIR/frontend/out/"
else
  echo "=== [2-3/4] 跳过前端构建（--no-frontend）==="
fi

if [ "$SKIP_BACKEND" = false ]; then
  echo "=== [4/4] 重启后端 ==="
  ssh "$SERVER" "systemctl restart lumenx && sleep 2 && systemctl status lumenx --no-pager | tail -5"
else
  echo "=== [4/4] 跳过后端重启（--no-backend）==="
fi

echo ""
echo "✓ 部署完成 → http://172.16.3.34/lumenx/"
