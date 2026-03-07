#!/bin/bash
set -e

echo "=========================================="
echo "  推送代码到Ubuntu服务器并部署"
echo "=========================================="
echo ""

# 配置
SERVER_USER="leaif"
SERVER_IP="192.168.1.237"
SSH_KEY="C:/Users/12991/Keys/X230"
PROJECT_PATH="~/opt/AIagent"

# 检查是否有未提交的更改
if [[ -n $(git status -s) ]]; then
    echo "📝 检测到未提交的更改"
    read -p "是否提交更改? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "请输入提交信息: " commit_msg
        git add .
        git commit -m "$commit_msg"
        echo "✅ 代码已提交"
    else
        echo "⚠️  跳过提交，仅推送已提交的代码"
    fi
fi

# 推送到远程仓库
echo ""
echo "📤 推送代码到远程仓库..."
git push origin main || {
    echo "⚠️  推送失败，可能没有配置远程仓库"
    echo "继续尝试直接部署到服务器..."
}

# SSH连接服务器并执行更新
echo ""
echo "🚀 连接服务器并执行部署..."
ssh -i "$SSH_KEY" ${SERVER_USER}@${SERVER_IP} "cd ${PROJECT_PATH} && ./deploy/update.sh"

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "🌐 访问地址: http://38.22.235.27:8080"
echo ""
