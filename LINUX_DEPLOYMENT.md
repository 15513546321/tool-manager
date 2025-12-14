# Linux 部署完整指南

## 📋 目录

1. [系统要求](#系统要求)
2. [前置准备](#前置准备)
3. [部署步骤](#部署步骤)
4. [配置优化](#配置优化)
5. [故障排查](#故障排查)
6. [维护与监控](#维护与监控)
7. [高级部署](#高级部署)

---

## 系统要求

### 最低配置

| 项目 | 要求 | 备注 |
|------|------|------|
| 操作系统 | Ubuntu 18.04+ / CentOS 7+ / RedHat 7+ | 推荐 Ubuntu 20.04 LTS |
| CPU | 2核心 | 建议 4核心 |
| 内存 | 4GB | 建议 8GB，生产环境 16GB+ |
| 磁盘 | 20GB | 用于应用、日志、数据库 |
| Java | JDK 11+ | 强烈推荐 OpenJDK 11 LTS |
| Maven | 3.6+ | 用于构建 |
| Node.js | v16+ | 仅在构建时需要 |

### 推荐的生产环境配置

```
CPU: 8核+  |  内存: 16GB+  |  磁盘: 100GB+  |  Ubuntu 20.04 LTS
```

---

## 前置准备

### 步骤 1: 安装 Java

#### Ubuntu/Debian

```bash
# 更新包管理器
sudo apt update

# 安装 OpenJDK 11
sudo apt install openjdk-11-jdk -y

# 验证安装
java -version
# 输出示例: openjdk version "11.0.x"
```

#### CentOS/RedHat

```bash
# 安装 OpenJDK 11
sudo yum install java-11-openjdk java-11-openjdk-devel -y

# 验证安装
java -version
```

### 步骤 2: 安装 Maven

```bash
# Ubuntu/Debian
sudo apt install maven -y

# CentOS/RedHat
sudo yum install maven -y

# 验证
mvn -v
```

### 步骤 3: 安装 Node.js (用于构建)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# 验证
node -v && npm -v
```

### 步骤 4: 创建应用用户和目录

```bash
# 创建专用用户
sudo useradd -m -d /home/toolmanager -s /bin/bash toolmanager

# 创建应用目录
sudo mkdir -p /opt/tool-manager
sudo mkdir -p /var/log/tool-manager
sudo mkdir -p /var/data/tool-manager

# 设置权限
sudo chown -R toolmanager:toolmanager /opt/tool-manager
sudo chown -R toolmanager:toolmanager /var/log/tool-manager
sudo chown -R toolmanager:toolmanager /var/data/tool-manager
```

---

## 部署步骤

### 方式 1: 从源代码构建 (推荐)

#### 步骤 1: 获取源代码

```bash
cd /opt/tool-manager
git clone https://github.com/yourusername/tool-manager.git .
# 或上传源代码到此目录
```

#### 步骤 2: 构建项目

```bash
# 安装前端依赖
npm install

# 编译前端
npm run build

# 进入后端目录
cd backend

# 构建 JAR
mvn clean package -DskipTests

# 验证结果
ls -lh target/tool-manager-backend-1.0.0.jar
```

#### 步骤 3: 部署 JAR

```bash
sudo cp target/tool-manager-backend-1.0.0.jar /opt/tool-manager/app.jar
sudo chown toolmanager:toolmanager /opt/tool-manager/app.jar
sudo chmod 755 /opt/tool-manager/app.jar
```

#### 步骤 3.5: 配置数据库路径 (可选)

#### 方案 A: 项目同级目录（推荐用于小型应用）

**目录结构**：
```
/opt/
├── tool-manager/              (应用主目录)
│   ├── app.jar
│   ├── start.sh
│   └── application.properties  (配置文件)
└── tool-manager-data/         (数据库同级目录) ⭐
    └── tooldb.mv.db
    └── tooldb.trace.db
```

**配置修改**：
修改 `/opt/tool-manager/application.properties`：
```properties
# 使用相对上级目录的路径
spring.datasource.url=jdbc:h2:file:../tool-manager-data/tooldb;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE

# 或使用绝对路径（更推荐）
spring.datasource.url=jdbc:h2:file:/opt/tool-manager-data/tooldb;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
```

**优点**：
- 📂 数据和应用分离，易于管理
- 🔄 应用重新部署时，数据不受影响
- 📊 便于数据备份

**缺点**：
- 需要确保目录权限正确

#### 方案 B: 项目内部目录（不推荐）

```properties
# 不推荐：数据存储在应用目录内
spring.datasource.url=jdbc:h2:file:./data/tooldb;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
```

**问题**：
- ❌ 应用更新时可能丢失数据
- ❌ 备份和维护困难

#### 方案 C: 标准系统路径（最推荐）

```properties
# 使用 /var/data/ 或 /var/lib/ 等标准位置
spring.datasource.url=jdbc:h2:file:/var/data/tool-manager/tooldb;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
```

**目录权限设置**：
```bash
# 创建数据目录
sudo mkdir -p /var/data/tool-manager

# 设置权限
sudo chown toolmanager:toolmanager /var/data/tool-manager
sudo chmod 750 /var/data/tool-manager

# 验证
ls -ld /var/data/tool-manager
```

---

### 步骤 4: 创建启动脚本

创建 `/opt/tool-manager/start.sh`:

```bash
#!/bin/bash

APP_HOME="/opt/tool-manager"
APP_JAR="$APP_HOME/app.jar"
APP_USER="toolmanager"
APP_PORT="8080"
LOG_FILE="/var/log/tool-manager/app.log"
PID_FILE="$APP_HOME/app.pid"
JAVA_HOME="/usr/lib/jvm/java-11-openjdk-amd64"

start() {
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo "✅ 应用已在运行 (PID: $OLD_PID)"
            return 0
        fi
    fi
    
    echo "🚀 正在启动 Tool Manager..."
    sudo -u "$APP_USER" bash -c "
        cd $APP_HOME
        nohup $JAVA_HOME/bin/java -Xms512m -Xmx2048m \
            -Dserver.port=$APP_PORT \
            -Dlogging.file.name=$LOG_FILE \
            -jar $APP_JAR > $LOG_FILE 2>&1 &
        echo \$! > $PID_FILE
    "
    
    sleep 3
    if [ -f "$PID_FILE" ]; then
        echo "✅ 应用已启动 (PID: $(cat $PID_FILE))"
        echo "📝 日志文件: $LOG_FILE"
        echo "🌐 访问地址: http://localhost:$APP_PORT"
    fi
}

stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo "⚠️  应用未运行"
        return 0
    fi
    
    PID=$(cat "$PID_FILE")
    echo "🛑 正在停止应用 (PID: $PID)..."
    kill "$PID" 2>/dev/null
    sleep 2
    
    if ! kill -0 "$PID" 2>/dev/null; then
        rm -f "$PID_FILE"
        echo "✅ 应用已停止"
    else
        kill -9 "$PID" 2>/dev/null
        rm -f "$PID_FILE"
        echo "✅ 应用已强制停止"
    fi
}

status() {
    if [ ! -f "$PID_FILE" ]; then
        echo "❌ 应用未运行"
        return 1
    fi
    
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "✅ 应用正在运行 (PID: $PID)"
    else
        echo "❌ 应用未运行"
        rm -f "$PID_FILE"
    fi
}

logs() {
    tail -f "$LOG_FILE"
}

case "${1:-help}" in
    start)  start ;;
    stop)   stop ;;
    restart) stop; sleep 2; start ;;
    status) status ;;
    logs)   logs ;;
    *)      echo "用法: $0 {start|stop|restart|status|logs}"; exit 1 ;;
esac
```

设置权限：

```bash
sudo chmod +x /opt/tool-manager/start.sh
```

#### 步骤 5: 启动应用

```bash
# 启动
/opt/tool-manager/start.sh start

# 查看状态
/opt/tool-manager/start.sh status

# 查看日志
/opt/tool-manager/start.sh logs

# 验证访问
curl http://localhost:8080
```

### 方式 2: 使用预编译 JAR

```bash
# 上传 JAR 到服务器
scp tool-manager-backend-1.0.0.jar user@host:/opt/tool-manager/

# 启动应用
/opt/tool-manager/start.sh start
```

---

## 配置优化

### 1. Systemd 服务自启

创建 `/etc/systemd/system/tool-manager.service`:

```ini
[Unit]
Description=Tool Manager Application
After=network.target

[Service]
Type=simple
User=toolmanager
WorkingDirectory=/opt/tool-manager
ExecStart=/opt/tool-manager/start.sh start
Restart=on-failure
RestartSec=10s

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable tool-manager
sudo systemctl start tool-manager
```

### 2. Nginx 反向代理

创建 `/etc/nginx/sites-available/tool-manager`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用：

```bash
sudo ln -s /etc/nginx/sites-available/tool-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. 防火墙配置

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 或 firewall-cmd (CentOS)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## 故障排查

### 应用无法启动

```bash
# 查看日志
tail -100 /var/log/tool-manager/app.log

# 检查端口占用
sudo lsof -i :8080

# 检查权限
ls -l /opt/tool-manager/app.jar

# 检查磁盘空间
df -h
```

### 应用运行缓慢

```bash
# 监控资源
top -p $(cat /opt/tool-manager/app.pid)

# 增加内存
# 修改 start.sh 中的 -Xmx2048m
```

### 数据库错误

```bash
# 检查数据库文件
ls -lh /var/data/tool-manager/

# 重建数据库（删除旧数据）
sudo rm /var/data/tool-manager/tooldb.*
# 重启应用会自动重建
```

---

## 维护与监控

### 日志管理

```bash
# 实时查看
tail -f /var/log/tool-manager/app.log

# 搜索错误
grep "ERROR" /var/log/tool-manager/app.log
```

### 备份策略

```bash
# 定期备份数据库
mkdir -p /backup/tool-manager
cp /var/data/tool-manager/tooldb.mv.db /backup/tool-manager/tooldb.mv.db.$(date +%Y%m%d)

# 设置 crontab (每天午夜备份)
crontab -e
# 0 0 * * * cp /var/data/tool-manager/tooldb.mv.db /backup/tool-manager/tooldb.mv.db.$(date +\%Y\%m\%d)
```

---

## 高级部署

### Docker 部署

```dockerfile
FROM openjdk:11-jre-slim

WORKDIR /app
COPY tool-manager-backend-1.0.0.jar app.jar

EXPOSE 8080
CMD ["java", "-Xms512m", "-Xmx2048m", "-jar", "app.jar"]
```

```bash
docker build -t tool-manager:2.1.2 .
docker run -d -p 8080:8080 -v /var/data/tool-manager:/app/data tool-manager:2.1.2
```

### 负载均衡集群

```nginx
upstream tool_manager {
    server localhost:8080;
    server localhost:8081;
    server localhost:8082;
}

server {
    listen 80;
    location / {
        proxy_pass http://tool_manager;
    }
}
```

---

## 快速参考

| 任务 | 命令 |
|------|------|
| 启动 | `/opt/tool-manager/start.sh start` |
| 停止 | `/opt/tool-manager/start.sh stop` |
| 重启 | `/opt/tool-manager/start.sh restart` |
| 状态 | `/opt/tool-manager/start.sh status` |
| 日志 | `/opt/tool-manager/start.sh logs` |
| 检查端口 | `sudo lsof -i :8080` |
| 查看进程 | `ps aux \| grep tool-manager` |
| 备份数据 | `cp /var/data/tool-manager/*.db /backup/` |

---

## 常见问题

**Q: 如何修改应用端口？**  
A: 修改 `start.sh` 中的 `APP_PORT` 或配置文件中的 `server.port`

**Q: 应用需要多大堆内存？**  
A: 开发 512MB、测试 1GB、生产 2-4GB

**Q: 如何升级应用？**  
A: 停止应用 → 替换 JAR → 启动应用（数据自动迁移）

**Q: 如何监控应用状态？**  
A: 使用 `top` 监控、查看日志、集成 Prometheus 监控

---

## 技术支持

遇到问题？
- 📖 查看日志: `/var/log/tool-manager/app.log`
- 🔍 检查资源: `top`, `free -h`, `df -h`
- 💾 恢复备份: `cp /backup/tooldb.mv.db /var/data/tool-manager/`
- 📞 联系技术支持

