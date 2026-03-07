# 部署文档

## 快速开始

### 1. 首次部署到Ubuntu服务器

#### 步骤1: SSH连接服务器
```bash
ssh -i C:\Users\12991\Keys\X230 leaif@192.168.1.237
```

#### 步骤2: 安装Docker（如未安装）
```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 重新登录使权限生效
exit
# 再次SSH连接
```

#### 步骤3: 克隆项目
```bash
mkdir -p ~/opt
cd ~/opt
git clone <你的仓库地址> AIagent
cd AIagent
```

#### 步骤4: 配置环境变量
```bash
cp deploy/.env.production .env
nano .env
```

填写必填项：
- `ANTHROPIC_API_KEY` 或 `DEEPSEEK_API_KEY`（至少一个）
- `JWT_SECRET`（建议用 `openssl rand -hex 32` 生成）

#### 步骤5: 执行部署
```bash
chmod +x deploy/deploy.sh deploy/update.sh
./deploy/deploy.sh
```

### 2. 配置frp端口映射

在Ubuntu服务器的frpc.ini中添加：

```ini
[aiagent-web]
type = tcp
local_ip = 127.0.0.1
local_port = 80
remote_port = 8080
```

重启frpc服务后，访问：`http://38.22.235.27:8080`

---

## 日常开发流程

### 本地开发
```bash
cd C:\Users\12991\Desktop\AIagent
# 修改代码...
```

### 推送到服务器
```bash
# 使用推送脚本（推荐）
bash scripts/push-to-server.sh
```

脚本会自动：
1. 提交代码（如有未提交更改）
2. 推送到远程仓库
3. SSH连接服务器
4. 执行更新脚本

---

## 常用命令

### 查看服务状态
```bash
ssh -i C:\Users\12991\Keys\X230 leaif@192.168.1.237
cd ~/opt/AIagent
docker compose -f deploy/docker-compose.prod.yml ps
```

### 查看日志
```bash
# 所有服务
docker compose -f deploy/docker-compose.prod.yml logs -f

# 单个服务
docker compose -f deploy/docker-compose.prod.yml logs -f backend
```

### 停止服务
```bash
docker compose -f deploy/docker-compose.prod.yml down
```

### 重启服务
```bash
docker compose -f deploy/docker-compose.prod.yml restart
```

---

## 访问地址

- **本地测试**: http://localhost
- **局域网**: http://192.168.1.237
- **公网(frp)**: http://38.22.235.27:8080

默认管理员账号：
- 用户名: `admin`
- 密码: `admin123`

---

## 故障排查

### 容器无法启动
```bash
# 查看详细日志
docker compose -f deploy/docker-compose.prod.yml logs

# 检查.env配置
cat .env
```

### 无法访问
1. 检查防火墙：`sudo ufw status`
2. 检查端口占用：`sudo netstat -tlnp | grep 80`
3. 检查frp配置和状态

### 数据库问题
```bash
# 进入backend容器
docker exec -it aiagent-backend bash

# 查看数据库
ls -lh metadata.db chroma_data/
```
