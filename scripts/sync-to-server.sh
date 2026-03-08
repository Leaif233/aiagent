#!/bin/bash
# 自动同步代码到服务器并重启

SERVER_USER="leaif"
SERVER_IP="192.168.1.237"
SSH_KEY="C:/Users/12991/Keys/X230/id_rsa"
PROJECT_PATH="~/opt/AIagent"

echo "=== 同步代码到服务器 ==="

# 1. 提交本地修改
echo "1. 提交本地修改..."
git add .
git commit -m "Update: $(date '+%Y-%m-%d %H:%M:%S')"
git push origin main

# 2. 复制修改的文件到服务器
echo "2. 复制文件到服务器..."
scp -i "$SSH_KEY" -r backend/api/*.py $SERVER_USER@$SERVER_IP:$PROJECT_PATH/backend/api/
scp -i "$SSH_KEY" -r frontend/src/* $SERVER_USER@$SERVER_IP:$PROJECT_PATH/frontend/src/

# 3. 服务器重启服务
echo "3. 重启服务..."
ssh -i "$SSH_KEY" $SERVER_USER@$SERVER_IP "cd $PROJECT_PATH && ./stop.sh && ./start.sh"

echo "=== 同步完成 ==="
