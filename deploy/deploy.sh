#!/bin/bash
set -e

echo "=========================================="
echo "  AI技术支持系统 - 一键部署脚本"
echo "=========================================="
echo ""

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker未安装"
    echo "请先安装Docker: https://docs.docker.com/engine/install/"
    exit 1
fi

# 检查Docker Compose
if ! docker compose version &> /dev/null; then
    echo "❌ 错误: Docker Compose未安装"
    echo "请先安装Docker Compose V2"
    exit 1
fi

echo "✅ Docker环境检查通过"
echo ""

# 检查.env文件
if [ ! -f .env ]; then
    echo "⚠️  未找到.env文件，正在从模板创建..."
    if [ -f deploy/.env.production ]; then
        cp deploy/.env.production .env
        echo "✅ 已创建.env文件"
        echo ""
        echo "⚠️  请编辑.env文件，填入以下必填项："
        echo "   - ANTHROPIC_API_KEY 或 DEEPSEEK_API_KEY (至少一个)"
        echo "   - JWT_SECRET (建议使用: openssl rand -hex 32)"
        echo ""
        echo "编辑完成后，重新运行此脚本"
        exit 0
    else
        echo "❌ 错误: 未找到deploy/.env.production模板"
        exit 1
    fi
fi

echo "✅ 找到.env配置文件"
echo ""

# 停止旧容器
echo "🔄 停止旧容器..."
docker compose -f deploy/docker-compose.prod.yml down 2>/dev/null || true
echo ""

# 构建并启动
echo "🚀 构建并启动服务..."
docker compose -f deploy/docker-compose.prod.yml up -d --build

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "📊 容器状态:"
docker compose -f deploy/docker-compose.prod.yml ps
echo ""
echo "🌐 访问地址:"
echo "   - 本地: http://localhost"
echo "   - 局域网: http://192.168.1.237"
echo "   - 公网(frp): http://38.22.235.27:8080"
echo ""
echo "👤 默认管理员账号:"
echo "   用户名: admin"
echo "   密码: admin123"
echo ""
echo "📝 查看日志: docker compose -f deploy/docker-compose.prod.yml logs -f"
echo "🛑 停止服务: docker compose -f deploy/docker-compose.prod.yml down"
echo ""
