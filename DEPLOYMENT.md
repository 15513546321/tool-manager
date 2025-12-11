# Tool Manager 项目 - 完整部署指南

## 项目结构
```
tool-manager/
├── backend/                           # Spring Boot + H2 数据库后端
│   └── src/main/resources/static/    # 嵌入的前端静态文件（自动生成）
├── package.json                       # 前端项目配置
├── vite.config.ts                     # 前端构建配置（输出到 backend/static）
├── start.ps1                          # 一键启动脚本（推荐）
└── DEPLOYMENT.md                      # 本文件
```

## 前置要求
- **Java** 11+ （用于后端）
- **Maven** 3.6+ （用于编译后端）
- **Node.js** 14+ （仅用于开发前端，生产部署不需要）

## 快速启动（推荐方式）

### 方式 1：使用一键启动脚本（最简单）

在项目根目录运行：

```powershell
.\start.ps1
```

脚本会自动：
1. 检查 Java 和 Maven
2. 编译后端和嵌入的前端
3. 启动 Spring Boot 应用

然后在浏览器访问：**`http://localhost:8080`**

---

### 方式 2：手动启动

#### Step 1: 构建前端（首次或前端改动时）

```bash
npm install
npm run build
```

前端会自动打包到 `backend/src/main/resources/static/`

#### Step 2: 启动后端

```bash
cd backend
mvn clean spring-boot:run
```

后端启动在 **`http://localhost:8080`**，同时提供：
- 前端网页（静态文件）
- 所有 REST API（审计日志、IP 映射等）
- H2 数据库管理界面（可选：`http://localhost:8080/h2-console`）

---

## 架构说明

### 前后端集成方式
- **前端**：React + TypeScript，使用 Vite 构建
- **后端**：Spring Boot 3.1.5，提供 REST API 和静态文件服务
- **数据库**：H2（嵌入式，无需单独安装）
- **打包方式**：前端代码编译到后端的 `static` 目录，随后端 JAR 一起部署

### 核心 REST API
```
# 审计日志
POST   /api/audit/log                  - 记录审计日志
GET    /api/audit/logs                 - 获取所有审计日志
GET    /api/audit/logs/latest?limit=N  - 获取最新 N 条日志

# IP 映射
GET    /api/ip-mappings                - 获取所有 IP 映射
POST   /api/ip-mappings                - 添加 IP 映射
PUT    /api/ip-mappings/{ip}           - 更新 IP 映射
DELETE /api/ip-mappings/{ip}           - 删除 IP 映射
GET    /api/ip-mappings/lookup/{ip}    - 查询特定 IP 的映射

# 客户端 IP
GET    /api/client-ip                  - 获取当前客户端真实 IP（自动识别）

# 前端
GET    /                               - 返回 index.html
GET    /assets/*                       - 返回前端静态资源
```

### 数据库（H2）
- **数据文件**：`backend/data/tooldb.h2.db`
- **JDBC URL**：`jdbc:h2:file:./data/tooldb;MODE=MySQL`
- **用户名**：`sa`
- **密码**：（空）
- **H2 Console**：`http://localhost:8080/h2-console`（可选调试）

---

## 功能说明

### 1. 审计日志
- **自动记录**：每个用户操作都会自动记录到数据库
- **IP 自动识别**：后端自动从请求头提取真实客户端 IP
  - 支持代理场景（X-Forwarded-For、X-Real-IP 等）
- **姓名映射**：根据 IP 映射表自动转换为用户姓名
- **查询**：在"审计日志"页面查看所有操作记录

### 2. IP 映射管理
- **添加映射**：在"IP 配置"页面添加 IP 与姓名的对应关系
- **更新/删除**：随时修改或删除映射
- **实时应用**：新映射立即应用于后续日志

### 3. 客户端 IP 识别
- **自动识别**：无需用户操作，后端自动获取真实 IP
- **代理支持**：即使在 nginx、负载均衡器后面也能正确识别
- **持久化**：IP 映射关系保存在 H2 数据库

---

## 开发和调试

### 前端开发模式

如果需要开发前端（实时热更新），保持后端运行，另开一个终端：

```bash
npm install
npm run dev
```

前端会运行在 `http://localhost:3000`，自动代理 API 请求到后端 `http://localhost:8080`。

### 数据库调试

访问 **`http://localhost:8080/h2-console`** 可以：
- 查看数据库表结构
- 执行 SQL 查询
- 查看实时数据

---

## 常见问题

### Q: 启动时出现 "Port 8080 already in use"？
**A**: 端口被占用。可以修改 `backend/src/main/resources/application.properties` 中的 `server.port` 为其他端口（如 9090）。

### Q: 如何清空所有数据？
**A**: 删除 `backend/data/` 目录（或 `tooldb.h2.db` 文件），重启后端会自动重建数据库和表结构。

### Q: 前端无法连接后端？
**A**: 
1. 确保后端已启动（`mvn spring-boot:run`）
2. 检查后端日志有无错误
3. 访问 `http://localhost:8080/api/client-ip` 测试后端是否响应

### Q: 如何在生产环境部署？
**A**: 
1. 在生产机器安装 Java 11+
2. 在开发机执行 `mvn clean package` 生成 JAR：`backend/target/tool-manager-backend-1.0.0.jar`
3. 在生产机运行：`java -jar tool-manager-backend-1.0.0.jar`
4. 配置 nginx/反向代理（可选）

### Q: 如何修改数据库文件位置？
**A**: 编辑 `backend/src/main/resources/application.properties`：
```properties
spring.datasource.url=jdbc:h2:file:/path/to/your/database;MODE=MySQL;...
```

### Q: 支持多用户同时访问吗？
**A**: 是的，H2 支持多客户端并发访问。生产环境如需更高可靠性，建议迁移到 MySQL、PostgreSQL 等。

---

## 后端项目结构详解

```
backend/
├── pom.xml                                    # Maven 配置
├── src/
│   ├── main/
│   │   ├── java/com/toolmanager/
│   │   │   ├── ToolManagerBackendApplication.java    # 启动类
│   │   │   ├── config/
│   │   │   │   └── WebConfig.java                   # Web 配置
│   │   │   ├── controller/
│   │   │   │   ├── AuditLogController.java          # 审计日志 API
│   │   │   │   ├── IpMappingController.java         # IP 映射 API
│   │   │   │   └── ClientIpController.java          # 客户端 IP API
│   │   │   ├── service/
│   │   │   │   ├── AuditLogService.java             # 审计日志业务逻辑
│   │   │   │   └── IpMappingService.java            # IP 映射业务逻辑
│   │   │   ├── repository/
│   │   │   │   ├── AuditLogRepository.java          # 审计日志数据访问
│   │   │   │   └── IpMappingRepository.java         # IP 映射数据访问
│   │   │   ├── entity/
│   │   │   │   ├── AuditLog.java                    # 审计日志实体
│   │   │   │   └── IpMapping.java                   # IP 映射实体
│   │   │   └── dto/
│   │   │       ├── AuditLogDto.java                 # 审计日志 DTO
│   │   │       └── IpMappingDto.java                # IP 映射 DTO
│   │   └── resources/
│   │       ├── application.properties               # 应用配置
│   │       └── static/                              # 前端静态文件（自动生成）
│   └── test/                                        # 测试代码
└── target/                                          # 编译输出（mvn build）
```

---

## 下一步

1. **启动项目**：运行 `.\start.ps1` 或按上述步骤启动
2. **访问首页**：打开 `http://localhost:8080`
3. **配置 IP 映射**：进入"IP 配置"页面添加第一条映射
4. **操作并查看日志**：在应用中进行操作，审计日志会自动记录
5. **查看结果**：进入"审计日志"页面验证日志和 IP 映射是否正确

---

## 技术栈总结

| 层次 | 技术 | 版本 |
|-----|------|------|
| **前端** | React + TypeScript | 18.2 |
| 前端构建 | Vite | 4.5 |
| **后端** | Spring Boot | 3.1.5 |
| 数据库 | H2 | 内嵌 |
| 数据访问 | JPA/Hibernate | 内置 |
| **Java** | OpenJDK/Oracle JDK | 11+ |
| **构建工具** | Maven | 3.6+ |
