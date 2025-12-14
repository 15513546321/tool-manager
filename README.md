<div align="center">

# 🛠️ Tool Manager

**全栈集成开发工具管理平台**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Java](https://img.shields.io/badge/Java-11-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-2.7.13-green.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org)
[![Deployed](https://img.shields.io/badge/Deployment-Single%20JAR-success.svg)](#deployment)

</div>

---

## 📋 简介

Tool Manager 是一个**全功能开发工具管理平台**，支持多种开发场景的配置、同步和代码生成。前后端完全集成，支持**单一JAR文件部署**。

### 核心能力

| 功能模块 | 描述 | 状态 |
|--------|------|------|
| **接口管理** | 代码接口定义、导入、生成 | ✅ 完成 |
| **文档仓库** | 在线代码仓库解析、文件管理 | ✅ 完成 |
| **Oracle同步** | 数据库表结构对比、DDL生成、执行 | ✅ 完成 |
| **GitLab报表** | 项目报表、议题查询、导出 | ✅ 完成 |
| **Gitee管理** | 多分支管理、变更集导出 | ✅ 完成 |
| **Nacos同步** | 配置中心数据同步 | ✅ 完成 |

---

## 🚀 快速开始

### 前置条件

- **Java 11+**
- **Maven 3.6+** (可选，使用Maven构建)
- **Node.js 18+** (仅在开发时需要，构建时自动下载)

### 方式1：直接运行JAR (推荐)

```bash
# 进入后端目录
cd backend

# 构建项目（自动包含前端编译）
mvn clean package -DskipTests

# 启动应用
java -jar target/tool-manager-backend-1.0.0.jar

# 访问应用
# 前端: http://localhost:8080
# H2 Console: http://localhost:8080/h2-console
```

### 方式2：开发模式（前后端分离）

```bash
# 终端1: 启动后端
cd backend
mvn spring-boot:run

# 终端2: 启动前端开发服务器
npm install
npm run dev
# 前端自动代理API请求到 http://localhost:8080
```

---

## 📦 项目结构

```
tool-manager/
├── 📄 package.json                 # 前端项目配置
├── 📄 tsconfig.json               # TypeScript配置
├── 📄 vite.config.ts              # Vite构建配置
├── 📁 pages/                      # React页面组件
│   ├── OracleSync.tsx             # Oracle同步模块
│   ├── GitlabReports.tsx          # GitLab报表模块
│   ├── GiteeManagement.tsx        # Gitee管理模块
│   ├── Announcement.tsx           # 公告管理
│   ├── AuditLog.tsx              # 审计日志
│   └── interface/
│       ├── CodeGenerator.tsx      # 代码生成器
│       └── DocManagement.tsx      # 文档管理
├── 📁 components/                 # 可复用组件
├── 📁 services/                   # API服务层
├── 📁 backend/                    # Spring Boot后端
│   ├── pom.xml                   # Maven配置（含前端构建插件）
│   └── src/
│       ├── main/
│       │   ├── java/
│       │   │   └── com/toolmanager/
│       │   │       ├── controller/    # REST API
│       │   │       ├── service/       # 业务逻辑
│       │   │       ├── entity/        # 数据模型
│       │   │       ├── repository/    # 数据访问层
│       │   │       └── config/        # 配置类
│       │   └── resources/
│       │       ├── application.properties
│       │       ├── init-data.sql
│       │       └── static/            # 打包的前端文件
│       └── test/
└── 📄 DEPLOYMENT_GUIDE.md         # 部署指南
```

---

## 🎯 核心功能

### 1️⃣ 接口管理与代码生成

- **远程导入**: 从Git仓库导入接口定义
- **Excel编辑**: 支持复制粘贴的批量编辑
- **代码生成**: 自动生成JAVA代码
- **字段配置**: 灵活的参数定义和映射

### 2️⃣ 文档仓库管理

- **多认证方式**: HTTP Basic / Token / SSH Key
- **在线解析**: 直接从Git仓库获取代码
- **分支管理**: 支持多分支查询
- **配置保存**: 自动保存连接配置

### 3️⃣ Oracle DDL同步

- **表结构对比**: 源库与目标库对比
- **DDL生成**: 自动生成修改脚本
- **脚本下载**: 导出SQL文件
- **在线执行**: 直接在目标库执行修改（含确认提示）

### 4️⃣ GitLab报表

- **灵活查询**: 支持项目、议题、合并请求查询
- **动态字段**: 配置导出字段（含description等详细信息）
- **分页展示**: 大数据量分页加载
- **Excel导出**: 支持自定义导出

### 5️⃣ Gitee管理

- **多分支选择**: 支持同时选中多个分支
- **需求分组**: 自动按需求分组变更集
- **导出配置**: 字段可配置（需求号、负责人、评审状态等）
- **双格式导出**: TXT列表 / Excel表格

### 6️⃣ Nacos同步

- **配置查询**: 查询Nacos配置中心数据
- **版本管理**: 跟踪配置版本变更
- **同步对比**: 不同环境配置对比

---

## 📊 技术栈

### 前端

- **React 18** - UI框架
- **TypeScript 5** - 类型安全
- **Tailwind CSS** - 样式框架
- **Lucide React** - 图标库
- **XLSX** - Excel导出
- **Vite** - 构建工具

### 后端

- **Spring Boot 2.7.13** - 应用框架
- **Spring Data JPA** - 数据访问
- **H2 Database** - 嵌入式数据库
- **Lombok** - 代码简化
- **Maven** - 项目构建

### 数据库

- **H2** - 开发/演示环境
- **支持迁移** - 可改为MySQL/Oracle/PostgreSQL

---

## 🔧 开发指南

### 添加新页面

1. 在 `pages/` 目录创建React组件
2. 在 `App.tsx` 中添加路由
3. 调用 `apiService` 访问后端API
4. 使用 `recordAction` 记录审计日志

### 添加新API

1. 创建 `@RestController` 类
2. 定义Entity和Repository
3. 实现Service业务逻辑
4. 在前端调用时添加对应的apiService方法

### 审计日志

所有操作自动记录到数据库：
```typescript
import { recordAction } from '../services/auditService';

// 记录用户操作
recordAction('模块名', '操作描述 - 详细信息');
```

---

## 📈 性能指标

| 指标 | 值 |
|-----|-----|
| **JAR文件大小** | 37.8 MB |
| **启动时间** | 8-9秒 |
| **API端点数** | 45+ |
| **数据库表** | 10+ |
| **前端资源** | 386 KB (gzip) |
| **JVM堆内存** | 256-512 MB |

---

## 🐳 Docker部署

```bash
# 构建镜像
docker build -t tool-manager:latest .

# 运行容器
docker run -d \
  --name tool-manager \
  -p 8080:8080 \
  -v /data/toolmanager:/data/toolmanager \
  tool-manager:latest

# 查看日志
docker logs -f tool-manager
```

---

## 📝 API文档

完整的REST API可通过以下方式访问：

```bash
# 启动应用后，浏览器访问
# http://localhost:8080/api/audit-logs (获取审计日志)
# http://localhost:8080/api/system-param/all (系统参数)
# 其他API端点可在代码中查看
```

---

## 🔐 安全特性

- ✅ **H2 Console**: 开发模式启用，生产环境禁用
- ✅ **CORS**: 配置跨域策略
- ✅ **Session管理**: HttpOnly Cookie
- ✅ **敏感数据**: 不持久化密码/Token
- ✅ **审计日志**: 完整的操作记录

---

## 🐛 故障排查

### 应用无法启动

```bash
# 检查Java版本
java -version  # 需要11+

# 检查端口占用
lsof -i :8080

# 查看详细错误日志
java -jar app.jar --logging.level.root=DEBUG
```

### 前端加载失败

```bash
# 确认前端文件已打包
jar tf tool-manager-backend-1.0.0.jar | grep static/index.html

# 清理浏览器缓存并刷新
```

### 数据库连接失败

```bash
# H2数据库位置
./data/toolmanager.mv.db

# 清空数据库重新初始化
rm -f data/toolmanager*
# 重启应用
```

更多信息见 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

## 📚 文档

- [🚀 快速开始指南](./QUICK_START.md) - 最快上手
- [📦 部署指南](./DEPLOYMENT_GUIDE.md) - 完整部署说明
- [✅ 功能完整性说明](./ITERATION_v2.0_COMPLETE.md) - 功能清单

---

## 🤝 贡献指南

欢迎提交Issue和PR！

### 开发流程

1. Fork项目
2. 创建feature分支 (`git checkout -b feature/xxx`)
3. 提交更改 (`git commit -m 'Add xxx'`)
4. 推送到分支 (`git push origin feature/xxx`)
5. 创建Pull Request

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

## 💬 联系方式

- **GitHub**: https://github.com/15513546321/tool-manager
- **问题反馈**: GitHub Issues
- **讨论区**: GitHub Discussions

---

<div align="center">

**⭐ 如果对你有帮助，请点个Star支持一下！**

Made with ❤️ by Tool Manager Team

</div>
