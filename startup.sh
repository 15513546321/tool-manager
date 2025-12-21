#!/bin/bash
# 启动后端和前端的完整脚本

echo "================================"
echo "启动 tool-manager 应用"
echo "================================"
echo ""

# 获取当前脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "[1/3] 启动后端服务 (port 8080)..."
cd "$SCRIPT_DIR/backend"
java -jar target/tool-manager-backend-1.0.0.jar &
BACKEND_PID=$!
echo "✓ 后端启动成功 (PID: $BACKEND_PID)"
echo ""

echo "[2/3] 等待后端完全启动..."
sleep 8
echo "✓ 后端应该已启动"
echo ""

echo "[3/3] 启动前端开发服务器 (port 3000)..."
cd "$SCRIPT_DIR"
npm run dev
