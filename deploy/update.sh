#!/bin/bash
set -e

echo "=========================================="
echo "  AI技术支持系统 - 快速更新脚本"
echo "=========================================="
echo ""

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main || {
    echo "⚠️  Git拉取失败，跳过此步骤"
}
echo ""

# 重新构建并启动
echo "🔄 重新构建并启动服务..."
docker compose -f deploy/docker-compose.prod.yml up -d --build

echo ""
echo "✅ 更新完成！"
echo ""
echo "📝 查看日志: docker compose -f deploy/docker-compose.prod.yml logs -f"
echo ""
