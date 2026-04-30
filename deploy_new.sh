#!/bin/bash
# 新服务器部署脚本（10.5.0.92，通过堡垒机访问）
# 用法：在新服务器上执行 bash deploy_new.sh
set -e

DEPLOY_DIR="/home/sysadmin/data/lumenx"

cd "$DEPLOY_DIR"

echo "=== [1/4] git pull ==="
git pull origin main

echo "=== [2/4] 安装 Python 依赖 ==="
source .venv/bin/activate
grep -v pywebview requirements.txt | pip install -i https://mirrors.aliyun.com/pypi/simple/ -q -r /dev/stdin

echo "=== [3/4] 构建前端 ==="
cd "$DEPLOY_DIR/frontend"
npm ci --registry=https://registry.npmmirror.com --silent
DOCKER_BUILD=true npm run build

echo "=== [4/4] 重启服务 ==="
sudo systemctl restart lumenx
sudo /usr/local/openresty/nginx/sbin/nginx -s reload

echo "✓ 部署完成 → https://lumen.o.atdplus.cn/"
