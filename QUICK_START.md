# Tool Manager - 快速启动指南

## 概述
本指南提供快速启动 Tool Manager 应用的步骤。应用包含：
- **前端**：React 18 + Vite（自动内嵌到后端）
- **后端**：Spring Boot 2.7.x + Java 11 + H2 Database
- **数据存储**：H2 嵌入式数据库，数据持久化到 `tooldb.mv.db`

---

## 快速启动（本地开发）

### 前置要求
- **Java 11** 或以上
- **Maven 3.6+**
- **Node.js 16+**（仅用于前端构建）

### 步骤 1：准备环境

```bash
# 验证 Java 版本
java -version
# 输出应为: openjdk version "11.0.x"

# 验证 Maven 版本
mvn -v
# 输出应为: Apache Maven 3.6.x
```

### 步骤 2：构建前端

```bash
# 进入项目根目录
cd /path/to/tool-manager

# 安装依赖
npm install --legacy-peer-deps

# 构建（自动放入 backend/src/main/resources/static/）
npm run build
```

### 步骤 3：构建后端

```bash
# 进入 backend 目录
cd backend

# 构建 JAR 包
mvn clean package -DskipTests
```

### 步骤 4：启动应用

#### 方式 A：使用 Maven 直接运行

```bash
cd backend
mvn spring-boot:run
```

#### 方式 B：使用 JAR 文件运行

```bash
cd backend
java -jar target/tool-manager-backend-1.0.0.jar
```

#### 预期输出
```
...
2024-12-11 10:30:45.123  INFO 12345 --- [main] c.t.ToolManagerBackendApplication  : Started ToolManagerBackendApplication in 5.234 seconds
```

### 步骤 5：验证应用

```bash
# 1. 检查后端健康
curl http://localhost:8080/api/client-ip
# 输出: {"ip":"127.0.0.1"} 或实际的客户端 IP

# 2. 在浏览器中打开
# http://localhost:8080/
```

---

## 关键信息

### 1. 应用地址
- **前端页面**：http://localhost:8080/
- **H2 控制台**：http://localhost:8080/h2-console
  - 用户名: `sa`
  - 密码: (留空)

### 2. 数据库位置
```
Windows: G:\vsCodeWorkSpace\tool-manager\backend\data\tooldb.mv.db
Linux:   /opt/tool-manager/data/tooldb.mv.db
```

### 3. 核心 API 端点

| 功能 | 端点 | 方法 |
|-----|------|------|
| 记录操作 | `/api/audit/log` | POST |
| 查询审计日志 | `/api/audit/logs` | GET |
| 获取 IP 映射 | `/api/ip-mappings` | GET |
| 添加 IP 映射 | `/api/ip-mappings` | POST |
| 删除 IP 映射 | `/api/ip-mappings/{ip}` | DELETE |
| 获取客户端 IP | `/api/client-ip` | GET |

### 4. 数据流程

```
用户在前端执行操作
    ↓
调用 recordAction() 发送 HTTP POST 请求
    ↓
后端 AuditLogController 接收请求
    ↓
获取客户端真实 IP（过滤 IPv6 和回环）
    ↓
查询 IP 映射表获取用户名
    ↓
保存到 H2 数据库 (audit_logs 表)
    ↓
前端审计日志页面定期刷新，显示最新日志
```

---

## Linux 服务器部署

### 快速部署（5 分钟）

```bash
# 1. 安装 Java 11
sudo apt update && sudo apt install openjdk-11-jdk maven -y

# 2. 克隆项目
git clone https://github.com/15513546321/tool-manager.git /opt/tool-manager
cd /opt/tool-manager

# 3. 构建
npm install --legacy-peer-deps && npm run build
cd backend && mvn clean package -DskipTests

# 4. 运行
java -jar target/tool-manager-backend-1.0.0.jar

# 5. 验证
curl http://localhost:8080/api/client-ip
```

### 后台运行（systemd）

```bash
# 创建服务文件
sudo tee /etc/systemd/system/tool-manager.service > /dev/null <<EOF
[Unit]
Description=Tool Manager Backend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tool-manager/backend
ExecStart=/usr/bin/java -jar target/tool-manager-backend-1.0.0.jar
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
sudo systemctl daemon-reload
sudo systemctl start tool-manager
sudo systemctl enable tool-manager
sudo systemctl status tool-manager
```

### Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 常见问题

### Q1: 如何清空所有数据？

```bash
# 1. 停止后端
# (使用 Ctrl+C 或 sudo systemctl stop tool-manager)

# 2. 删除数据库文件
rm backend/data/tooldb.mv.db

# 3. 重启后端
mvn spring-boot:run
# 或
java -jar target/tool-manager-backend-1.0.0.jar
```

### Q2: 为什么所有 IP 都显示为 127.0.0.1？

- **本地访问**：正常。访问 http://127.0.0.1:8080 会显示 127.0.0.1
- **局域网访问**：检查是否通过代理，确保代理设置了 `X-Forwarded-For` 头
- **云端部署**：配置 Nginx/负载均衡器设置 `X-Real-IP` 和 `X-Forwarded-For` 头

### Q3: 如何修改服务端口？

编辑 `backend/src/main/resources/application.properties`：
```properties
server.port=8081
```

或启动时指定：
```bash
java -jar target/tool-manager-backend-1.0.0.jar --server.port=8081
```

### Q4: 如何导出审计日志数据？

```bash
# 方式 1：通过 H2 Web 控制台导出
# http://localhost:8080/h2-console → 右键表 → Export

# 方式 2：API 查询并保存为 JSON
curl http://localhost:8080/api/audit/logs > audit_logs.json
```

### Q5: 生产环境中如何保证数据安全？

1. **定期备份**
   ```bash
   cp backend/data/tooldb.mv.db backup/tooldb.backup.$(date +%Y%m%d).mv.db
   ```

2. **使用更强大的数据库**
   - 将 H2 升级到 PostgreSQL 或 MySQL

3. **配置 HTTPS**
   ```nginx
   listen 443 ssl;
   ssl_certificate /path/to/cert.pem;
   ssl_certificate_key /path/to/key.pem;
   ```

4. **限制 H2 控制台访问**
   ```
   spring.h2.console.enabled=false
   ```

5. **设置防火墙**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

---

## 详细文档

- **[Linux 部署手册](./LINUX_DEPLOYMENT.md)** - 完整的生产环境部署步骤
- **[数据交互指南](./DATA_INTERACTION.md)** - 详细的前后端交互流程和 API 文档
- **[部署指南](./DEPLOYMENT.md)** - 部署相关配置

---

## 支持

- 项目仓库：https://github.com/15513546321/tool-manager
- 问题反馈：https://github.com/15513546321/tool-manager/issues

---

**版本**：1.0  
**最后更新**：2024-12-11
