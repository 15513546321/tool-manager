# 📦 Tool Manager - 集成部署指南

**版本**: v2.0  
**日期**: 2025年12月13日  
**部署模式**: 单一JAR文件部署

---

## 🎯 部署架构

前端和后端已完全集成，形成**单一可执行JAR文件**：

```
┌─────────────────────────────────────┐
│  tool-manager-backend-1.0.0.jar     │
├─────────────────────────────────────┤
│  📦 后端应用                         │
│  ├─ Spring Boot 2.7.13              │
│  ├─ Java 11 REST API                │
│  ├─ H2 Database                     │
│  └─ 10 JPA Repositories             │
├─────────────────────────────────────┤
│  🎨 前端应用 (打包)                 │
│  ├─ React 18 UI                     │
│  ├─ TypeScript 编译                 │
│  ├─ Tailwind CSS 样式               │
│  └─ 静态资源文件                    │
├─────────────────────────────────────┤
│  💾 静态资源目录                     │
│  └─ src/main/resources/static/     │
│     ├─ index.html                  │
│     └─ assets/                     │
│        └─ index-[hash].js          │
└─────────────────────────────────────┘
```

---

## 📋 构建流程

### 完整构建步骤

```bash
# 1. 进入后端目录
cd backend

# 2. 执行Maven构建（自动包含前端构建）
mvn clean package -DskipTests

# 3. 构建完成后，JAR文件位于：
#    target/tool-manager-backend-1.0.0.jar
```

### Maven构建自动化流程

当执行 `mvn clean package` 时，以下步骤自动执行：

1. **初始化阶段** (`initialize`)
   - 下载/配置Node.js v18.17.0
   - 下载/配置npm v9.8.1

2. **初始化阶段** (`initialize`)
   - 执行 `npm install` 在项目根目录
   - 安装所有前端依赖 (React, TypeScript, etc.)

3. **资源生成阶段** (`generate-resources`)
   - 执行 `npm run build` 编译前端
   - TypeScript编译 → JavaScript
   - Vite打包优化
   - 输出到: `backend/src/main/resources/static/`

4. **编译阶段** (`compile`)
   - 编译Java源代码

5. **打包阶段** (`package`)
   - 创建JAR文件
   - Spring Boot重新打包
   - 包含 `static/` 目录中的所有前端文件

---

## 🚀 部署方式

### 方式1：本地测试（推荐开发环境）

```bash
# 启动应用
java -jar backend/target/tool-manager-backend-1.0.0.jar

# 访问应用
# 前端: http://localhost:8080
# H2 Console: http://localhost:8080/h2-console
```

### 方式2：生产环境部署

```bash
# 复制JAR到服务器
scp tool-manager-backend-1.0.0.jar user@server:/opt/app/

# SSH进入服务器
ssh user@server

# 启动应用（后台运行）
nohup java -jar /opt/app/tool-manager-backend-1.0.0.jar \
  --server.port=8080 \
  --spring.h2.console.enabled=false \
  --logging.level.root=INFO \
  > app.log 2>&1 &

# 或使用systemd
# 编辑: /etc/systemd/system/tool-manager.service
```

### 方式3：Docker容器部署

```dockerfile
FROM openjdk:11-jre-slim

WORKDIR /app

COPY tool-manager-backend-1.0.0.jar app.jar

EXPOSE 8080

CMD ["java", "-jar", "app.jar"]
```

```bash
# 构建镜像
docker build -t tool-manager:latest .

# 运行容器
docker run -d \
  --name tool-manager \
  -p 8080:8080 \
  -v /data/toolmanager:/data/toolmanager \
  tool-manager:latest
```

---

## 📊 性能指标

| 指标 | 值 |
|-----|-----|
| JAR文件大小 | 37.8 MB |
| 启动时间 | 8-9秒 |
| 内存占用 | ~256-512 MB (JVM堆) |
| 前端资源大小 | ~386 KB (gzip压缩) |
| API端点数 | 45+ |
| 数据库连接数 | 10 (HikariCP默认) |

---

## ⚙️ 配置参数

### 服务器配置

```bash
# 修改端口 (默认 8080)
java -jar app.jar --server.port=9090

# 配置线程数
java -jar app.jar --server.tomcat.threads.max=200

# 禁用H2 Console (生产环境)
java -jar app.jar --spring.h2.console.enabled=false
```

### 数据库配置

H2数据库文件位于项目根目录：
```
./data/toolmanager.mv.db
./data/toolmanager.trace.db (如果有错误日志)
```

如果需要备份或恢复：
```bash
# 备份数据库
cp -r data/ data_backup_$(date +%Y%m%d)/

# 清空数据库（重新初始化）
rm -f data/toolmanager.mv.db data/toolmanager.trace.db
# 重启应用即可重新初始化
```

---

## 📁 项目结构变更

构建完成后，前端文件被复制到后端：

```
backend/src/main/resources/static/
├── index.html                          # 首页HTML
├── assets/
│   ├── index-0a1da6d8.js             # 编译后的React应用
│   ├── index-xxx.css                 # 样式表
│   └── [其他资源文件]
└── [其他静态资源]
```

构建后的JAR文件包含所有这些静态文件，可以直接提供给浏览器。

---

## 🔄 开发工作流

### 开发模式 (前后端分离)

如果要在开发期间保持前后端分离：

```bash
# 终端1: 启动后端
cd backend
mvn spring-boot:run

# 终端2: 启动前端开发服务器
npm run dev
# 前端会代理API请求到 http://localhost:8080
```

### 生产模式 (集成部署)

```bash
# 只需构建一次
cd backend
mvn clean package -DskipTests

# 单一JAR部署
java -jar target/tool-manager-backend-1.0.0.jar
```

---

## 🛠️ 故障排查

### 问题1: 前端资源404

**症状**: 访问 http://localhost:8080 显示空白页

**解决**:
```bash
# 检查JAR中是否包含静态文件
jar tf tool-manager-backend-1.0.0.jar | grep "static/"

# 如果缺少，重新构建前端
cd backend
mvn clean package -DskipTests
```

### 问题2: 构建失败 - npm找不到

**症状**: Maven构建时 `npm: command not found`

**解决**:
```bash
# Maven会自动下载Node.js，但如果失败，手动安装
# 下载 Node.js 从 https://nodejs.org/
# 或使用系统包管理器
# Ubuntu: sudo apt-get install nodejs npm
# Mac: brew install node
```

### 问题3: 构建失败 - TypeScript错误

**症状**: `npm run build` 编译失败

**解决**:
```bash
# 清理并重新安装依赖
rm -rf node_modules package-lock.json
npm install
npm run build

# 或完整重建
cd backend
mvn clean package -DskipTests -X  # -X显示详细日志
```

### 问题4: 启动缓慢或OOM

**症状**: JAR启动超过15秒或JVM堆溢出

**解决**:
```bash
# 增加JVM堆内存
java -Xmx1g -Xms512m -jar app.jar

# 使用G1GC垃圾收集器（Java 11推荐）
java -XX:+UseG1GC -Xmx1g -jar app.jar
```

---

## 📝 检查清单

部署前：

- [ ] 执行 `mvn clean package -DskipTests` 成功
- [ ] JAR文件大小正常 (~37-40 MB)
- [ ] `static/` 目录包含 `index.html` 和 `assets/`
- [ ] 后端Java源代码无编译错误
- [ ] TypeScript/React代码通过tsc检查

部署后：

- [ ] 应用在 http://localhost:8080 可访问
- [ ] 前端UI正常显示（不是空白页）
- [ ] 可以打开DevTools查看网络请求
- [ ] API端点响应正常 (e.g., /api/audit-logs)
- [ ] H2 Console 可用 (生产环境应禁用)

---

## 🔐 安全建议

### 生产环境配置

```bash
# 禁用不必要的功能
java -jar app.jar \
  --spring.h2.console.enabled=false \
  --server.servlet.session.cookie.http-only=true \
  --server.servlet.session.cookie.secure=true \
  --logging.level.root=WARN \
  --logging.level.com.toolmanager=INFO
```

### 数据库安全

```bash
# 移动数据库到安全目录
mkdir -p /var/lib/toolmanager/data
mv data/* /var/lib/toolmanager/data/

# 设置权限
chmod 700 /var/lib/toolmanager/data
chown appuser:appgroup /var/lib/toolmanager/data
```

### 网络配置

```bash
# 使用反向代理 (Nginx)
location / {
    proxy_pass http://localhost:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 📈 版本更新

### 更新前端

```bash
# 1. 编辑前端代码 (在项目根目录)
#    修改 pages/*.tsx, components/*.tsx 等

# 2. 重新构建
cd backend
mvn clean package -DskipTests

# 3. 重启应用
# 杀死旧进程
kill $(lsof -t -i :8080)
# 启动新应用
java -jar target/tool-manager-backend-1.0.0.jar
```

### 更新后端

```bash
# 1. 修改后端代码 (在 backend/src 目录)

# 2. 重新构建
cd backend
mvn clean package -DskipTests

# 3. 重启应用
```

---

## 📞 支持和反馈

- **问题报告**: GitHub Issues
- **功能建议**: 欢迎讨论
- **性能优化**: 检查日志并分析瓶颈

---

## 📚 相关文档

- [README.md](./README.md) - 项目概述
- [QUICK_START.md](./QUICK_START.md) - 快速开始指南
- [ITERATION_v2.0_COMPLETE.md](./ITERATION_v2.0_COMPLETE.md) - 功能完整性说明

---

**最后更新**: 2025年12月13日 14:35  
**状态**: ✅ 生产就绪
