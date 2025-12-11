# Tool Manager - Linux 部署手册

## 概述
本文档提供了在 Linux 环境上部署 Tool Manager 应用的完整指南。应用由以下部分组成：
- **前端**：React 18 + TypeScript（Vite 构建，静态资源）
- **后端**：Spring Boot 2.7.x + Java 11 + H2 Database
- **数据存储**：H2 嵌入式数据库（文件形式，持久化）

## 部署架构

```
用户浏览器
    ↓
Nginx（反向代理，可选）
    ↓
Spring Boot 应用（端口 8080）
    ├── 前端静态资源（index.html、assets/）
    ├── 后端 REST API（/api/*)
    └── H2 数据库（./data/tooldb.mv.db）
```

## 前置要求

### 系统要求
- **操作系统**：Ubuntu 18.04+ / CentOS 7+ / 其他主流 Linux 发行版
- **网络**：可访问互联网（用于下载依赖）
- **磁盘空间**：≥ 2GB（用于依赖、应用和数据库）

### 软件依赖
1. **Java 11** (OpenJDK 或 Oracle JDK)
2. **Maven 3.6+**
3. **Node.js 16+**（仅用于前端构建，部署时不需要）
4. **Nginx**（可选，用于反向代理和 HTTPS）

## 第一步：安装依赖

### 1.1 安装 Java 11

**Ubuntu/Debian：**
```bash
sudo apt update
sudo apt install openjdk-11-jdk openjdk-11-jre -y
# 验证安装
java -version
# 输出示例：openjdk version "11.0.x"
```

**CentOS/RHEL：**
```bash
sudo yum install java-11-openjdk java-11-openjdk-devel -y
# 验证安装
java -version
```

### 1.2 安装 Maven 3.6+

**Ubuntu/Debian：**
```bash
sudo apt install maven -y
# 验证安装
mvn -v
# 输出示例：Apache Maven 3.6.x
```

**CentOS/RHEL：**
```bash
sudo yum install maven -y
# 验证安装
mvn -v
```

**或手动安装（通用方法）：**
```bash
# 下载 Maven
cd /opt
sudo wget https://archive.apache.org/dist/maven/maven-3/3.8.1/binaries/apache-maven-3.8.1-bin.tar.gz
sudo tar -xzf apache-maven-3.8.1-bin.tar.gz
sudo ln -s apache-maven-3.8.1 maven

# 添加到 PATH
echo 'export PATH=/opt/maven/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
mvn -v
```

### 1.3 安装 Node.js（仅用于前端构建）

**Ubuntu/Debian：**
```bash
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs
# 验证安装
node -v && npm -v
```

**CentOS/RHEL：**
```bash
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs
# 验证安装
node -v && npm -v
```

### 1.4 安装 Nginx（可选，用于反向代理）

**Ubuntu/Debian：**
```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

**CentOS/RHEL：**
```bash
sudo yum install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

## 第二步：获取源代码

### 2.1 克隆项目

```bash
# 创建部署目录
mkdir -p /opt/tool-manager
cd /opt/tool-manager

# 克隆 GitHub 仓库（示例 URL）
git clone https://github.com/15513546321/tool-manager.git .
# 或如果已有代码，直接上传到此目录
```

### 2.2 目录结构验证

```bash
ls -la /opt/tool-manager/
# 应该看到：
# - backend/           （Spring Boot 后端）
# - components/        （React 组件）
# - pages/             （React 页面）
# - services/          （前端服务）
# - package.json       （前端依赖）
# - pom.xml            （后端依赖，在 backend/ 下）
# - App.tsx
# - index.tsx
# 等等
```

## 第三步：构建前端

### 3.1 安装前端依赖

```bash
cd /opt/tool-manager
npm install --legacy-peer-deps
# 如果出现缓存问题，可尝试：
npm cache clean --force
npm install --legacy-peer-deps
```

### 3.2 构建前端（生成静态资源）

```bash
cd /opt/tool-manager
npm run build
# 输出应该显示：
# vite v4.5.x building for production...
# dist/index.html                   0.50 kB
# dist/assets/index-xxxxx.js        xxx.xx kB
# 生成的文件会自动放到 backend/src/main/resources/static/
```

## 第四步：构建后端

### 4.1 构建 JAR 包

```bash
cd /opt/tool-manager/backend
mvn clean package -DskipTests
# 这将下载所有依赖并编译，可能需要 3-5 分钟
# 成功后会在 backend/target/ 下生成：
# tool-manager-backend-1.0.0.jar
```

### 4.2 验证构建产物

```bash
ls -lh /opt/tool-manager/backend/target/tool-manager-backend-1.0.0.jar
# 应该看到一个 50-100 MB 的 JAR 文件
```

## 第五步：配置后端

### 5.1 编辑应用配置

```bash
# 编辑 backend/src/main/resources/application.properties
nano /opt/tool-manager/backend/src/main/resources/application.properties
```

**典型配置内容：**
```properties
spring.application.name=tool-manager-backend

# 服务端口（如果 8080 被占用，可改为 8081 等）
server.port=8080

# H2 数据库路径（确保 /opt/tool-manager/data/ 目录可写）
spring.datasource.url=jdbc:h2:file:/opt/tool-manager/data/tooldb;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE

# H2 控制台（可选，用于调试）
spring.h2.console.enabled=true
spring.h2.console.path=/h2-console

# JPA / Hibernate 配置
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false

# 日志级别
logging.level.root=INFO
logging.level.com.toolmanager=DEBUG
```

**关键说明：**
- `server.port`：应用监听的端口，确保防火墙允许该端口（见第六步）
- `spring.datasource.url`：H2 数据库文件路径，首次启动会自动创建
- `spring.h2.console.enabled=true`：可选，允许访问 H2 Web 控制台（http://localhost:8080/h2-console）

### 5.2 创建数据目录

```bash
mkdir -p /opt/tool-manager/data
chmod 755 /opt/tool-manager/data
# 验证权限
ls -ld /opt/tool-manager/data
```

## 第六步：部署和运行

### 6.1 直接运行（测试环境）

```bash
cd /opt/tool-manager/backend

# 方式 1：使用 Maven 直接运行
mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=8080"

# 方式 2：使用 Java 直接运行 JAR
java -jar target/tool-manager-backend-1.0.0.jar
```

**预期输出：**
```
...
2024-12-11 10:30:45.123  INFO 12345 --- [main] c.t.ToolManagerBackendApplication  : Started ToolManagerBackendApplication in 5.234 seconds (JVM running for 6.123)
```

### 6.2 验证服务运行

**在另一个终端窗口运行：**
```bash
# 测试后端 API
curl http://localhost:8080/api/client-ip

# 预期响应：
# {"ip":"xxx.xxx.xxx.xxx"}

# 访问前端页面
curl http://localhost:8080/
# 或在浏览器访问：http://<服务器IP>:8080/
```

### 6.3 后台运行（使用 systemd 服务）

**创建 systemd 服务文件：**
```bash
sudo tee /etc/systemd/system/tool-manager.service > /dev/null <<EOF
[Unit]
Description=Tool Manager Backend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tool-manager/backend
ExecStart=/usr/bin/java -jar target/tool-manager-backend-1.0.0.jar --server.port=8080
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

**启动服务：**
```bash
# 加载并启动服务
sudo systemctl daemon-reload
sudo systemctl start tool-manager
sudo systemctl enable tool-manager  # 开机自启

# 查看服务状态
sudo systemctl status tool-manager

# 查看日志
sudo journalctl -u tool-manager -f  # 实时日志
```

### 6.4 停止和重启服务

```bash
# 停止服务
sudo systemctl stop tool-manager

# 重启服务
sudo systemctl restart tool-manager
```

## 第七步：配置 Nginx 反向代理（可选）

如果需要在 80/443 端口或使用 HTTPS，可配置 Nginx 反向代理。

### 7.1 创建 Nginx 配置文件

```bash
sudo nano /etc/nginx/sites-available/tool-manager
```

**配置内容：**
```nginx
server {
    listen 80;
    server_name _;  # 或指定你的域名

    # 日志
    access_log /var/log/nginx/tool-manager-access.log;
    error_log /var/log/nginx/tool-manager-error.log;

    # 反向代理到后端
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（如需）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # H2 控制台（可选，仅用于调试，建议仅限内网访问）
    location /h2-console {
        proxy_pass http://localhost:8080/h2-console;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 7.2 启用配置

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/tool-manager /etc/nginx/sites-enabled/

# 测试 Nginx 配置
sudo nginx -t
# 输出：nginx: configuration file test is successful

# 重载 Nginx
sudo systemctl reload nginx
```

### 7.3 配置防火墙

```bash
# 允许 HTTP 流量
sudo ufw allow 80/tcp
sudo ufw allow 8080/tcp

# 允许 HTTPS（如使用）
sudo ufw allow 443/tcp

# 检查防火墙状态
sudo ufw status
```

## 第八步：数据库验证

### 8.1 查看 H2 数据库文件

```bash
# 首次启动后，应该看到数据库文件
ls -lh /opt/tool-manager/data/
# 输出示例：
# -rw-r--r-- 1 root root 1.2M Dec 11 10:35 tooldb.mv.db
```

### 8.2 H2 Web 控制台访问

如果 `spring.h2.console.enabled=true`，可以访问：
```
http://localhost:8080/h2-console
```

**登录信息：**
- URL: `jdbc:h2:file:/opt/tool-manager/data/tooldb`
- 用户名: `sa`
- 密码: (留空)

### 8.3 验证数据持久化

1. **在 Web 页面提交一条审计日志：**
   - 访问 http://localhost:8080/
   - 进入"审计日志"页面
   - 执行某个操作（如"添加 IP 映射"）

2. **查看数据库中的数据：**
   ```bash
   # 使用 H2 Web 控制台查看
   # 或使用命令行工具（如果安装了 h2）
   ```

## 第九步：监控和日志

### 9.1 查看后端日志

```bash
# systemd 日志
sudo journalctl -u tool-manager -n 100 -f

# 或从应用日志文件（如果配置了文件输出）
tail -f /opt/tool-manager/backend/logs/application.log
```

### 9.2 监控资源占用

```bash
# 查看 Java 进程
ps aux | grep java

# 监控内存和 CPU
top -p <PID>  # 替换为实际的 Java 进程 ID
```

### 9.3 常见日志问题

| 问题 | 日志表现 | 解决方案 |
|-----|--------|--------|
| 端口被占用 | `Address already in use` | 更改 `server.port` 或杀死占用进程 |
| 权限不足 | `Permission denied` | 确保 `/opt/tool-manager/data` 可写 |
| JVM 内存溢出 | `OutOfMemoryError` | 增加 JVM 堆内存：`java -Xmx512m -jar ...` |
| 数据库连接失败 | `Database connection error` | 检查 `spring.datasource.url` 配置 |

## 第十步：升级和维护

### 10.1 更新前端代码

```bash
cd /opt/tool-manager
git pull origin master
npm install --legacy-peer-deps
npm run build
```

### 10.2 更新后端代码

```bash
cd /opt/tool-manager/backend
git pull origin master
mvn clean package -DskipTests
sudo systemctl restart tool-manager
```

### 10.3 备份数据库

```bash
# 手动备份
cp /opt/tool-manager/data/tooldb.mv.db /backup/tooldb.backup.$(date +%Y%m%d_%H%M%S).mv.db

# 或创建定时备份（crontab）
crontab -e
# 添加行：0 2 * * * cp /opt/tool-manager/data/tooldb.mv.db /backup/tooldb.backup.$(date +\%Y\%m\%d).mv.db
```

## 故障排查

### 常见问题

1. **应用启动失败**
   ```bash
   # 查看详细错误
   java -jar target/tool-manager-backend-1.0.0.jar --debug
   ```

2. **前端无法访问后端 API**
   - 检查 CORS 配置（在 `ToolManagerBackendApplication.java` 中）
   - 确保防火墙允许后端端口

3. **H2 数据库损坏**
   ```bash
   # 删除损坏的数据库，重新启动会自动重建
   rm /opt/tool-manager/data/tooldb.mv.db
   sudo systemctl restart tool-manager
   ```

## 生产环境建议

1. **安全性**
   - 配置 HTTPS/TLS（通过 Nginx）
   - 限制 H2 控制台访问（仅内网）
   - 添加认证（如 Spring Security）

2. **性能**
   - 配置 JVM 堆内存：`-Xmx1g -Xms512m`
   - 启用数据库连接池
   - 考虑使用 PostgreSQL/MySQL 替代 H2（大数据量）

3. **高可用**
   - 配置多个实例
   - 使用负载均衡器（如 HAProxy）
   - 定期备份数据库

4. **监控告警**
   - 部署监控系统（如 Prometheus + Grafana）
   - 配置告警规则（如 CPU、内存、磁盘）

## 支持和反馈

如有问题，请提交 GitHub Issue：
https://github.com/15513546321/tool-manager/issues

---

**最后更新**：2024-12-11
**版本**：1.0
