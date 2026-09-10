# Tool Manager 开发基线说明

> 本文档整理自对当前仓库源代码、配置、项目说明与 Git 状态的实际检查，供后续新增功能页面时参考。
>
> 基线检查日期：2026-09-08  
> 基线分支：`masiyaTest`

## 1. 仓库状态与项目说明

- 检查时当前分支为 `masiyaTest`。
- 检查时工作区干净，没有已跟踪修改、暂存修改或未跟踪文件。
- 检查时最后一次提交为 `6c1b734`，提交信息为“优化样式”。
- 根目录存在 `README.md`、`ORACLE_CONNECTION_IMPROVEMENTS.md`。
- `RECOVERED_CODE/README.md` 说明 `RECOVERED_CODE/` 来自历史 JAR 的反编译/恢复，只应作为参考，不应作为正式开发源码。
- `.trae/documents/` 下存在知识库、PDF 预览和构建问题相关的历史方案文档。
- 未发现 `AGENTS.md` 或 `CONTRIBUTING.md`。
- `README.md` 中引用的部分文档，如 `DEPLOYMENT_GUIDE.md`、`QUICK_START.md` 和多份 Nacos 文档，当前仓库中并不存在。

## 2. 项目定位

Tool Manager 是一个前后端同仓的开发辅助和交付治理平台，主要覆盖：

- 接口文档解析、接口代码和模拟报文生成。
- 知识库文档及版本管理。
- 上线变更集录入、比包对账和变更步骤风险检查。
- GitLab 报表和 Gitee 仓库分析。
- Nacos 配置同步、Oracle DDL 同步、参数配置和缓存刷新。
- 公告、建议、审计、用户、角色、权限、菜单和 IP 映射管理。

项目支持前后端分离开发，也支持将前端资源打包进 Spring Boot 单 JAR 部署。

## 3. 技术栈与主要依赖

### 3.1 前端

- React `18.2.0`
- TypeScript `5.x`
- React Router DOM `6.14.2`
- Vite `4.4.5`
- Tailwind CSS `3.3.3`
- Lucide React 图标
- ExcelJS、XLSX、xlsx-populate
- Mammoth
- react-markdown
- react-pdf
- react-diff-viewer-continued

主要配置文件：

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `tailwind.config.js`
- `postcss.config.js`
- `src/globals.css`

项目没有使用 Ant Design、MUI 等完整组件库，也没有 Redux、Zustand、MobX 等全局状态库。

### 3.2 后端

- Java 11 编译目标
- Spring Boot `2.7.13`
- Spring MVC
- Spring Data JPA
- Bean Validation
- H2 文件数据库
- JWT（JJWT `0.12.3`）
- Spring Security Crypto
- Lombok
- Apache POI
- java-diff-utils
- Oracle、MySQL、PostgreSQL、SQL Server、MariaDB、Derby JDBC 驱动

后端主构建配置是 `backend/pom.xml`。

`backend/build.gradle` 使用 Spring Boot `3.1.5`，并且依赖集合明显少于 Maven 配置。当前 README 和单 JAR 构建流程都以 Maven 为准，因此 Gradle 是否仍受支持需要确认。

## 4. 启动、构建与测试

### 4.1 前端命令

```bash
npm install
npm run dev
npm run build
npm run preview
```

- `npm run dev` 启动 Vite，默认端口为 `3000`。
- `npm run build` 执行 `tsc && vite build`，输出到根目录 `dist/`。
- Vite 将 `/api` 代理到 `http://localhost:8080`。
- 当前没有 `npm test`、lint、Vitest/Jest 或 React Testing Library 配置。

### 4.2 后端命令

```bash
cd backend
mvn spring-boot:run
mvn test
mvn clean package -DskipTests
```

- 后端默认端口为 `8080`。
- Maven 打包流程会安装 Node/npm、安装前端依赖、执行前端构建，再将 `dist/` 复制到后端静态资源目录并生成单 JAR。
- `startup.sh` 要求预先存在 `backend/target/tool-manager-backend-1.0.0.jar`，然后再启动前端开发服务器。
- `build-and-deploy.bat` 内部硬编码了 `G:\vsCodeWorkSpace\tool-manager`，在当前仓库路径下不能直接作为可移植脚本使用。

### 4.3 当前环境检查结果

检查时：

- `node_modules/` 不存在。
- `dist/` 不存在。
- `backend/target/` 和目标 JAR 不存在。
- 仓库附带的 `node/node.exe` 为 Node `18.17.0`，但 `node/npm.cmd` 缺少其依赖的 `node/node_modules/npm/bin/npm-cli.js`，无法直接使用。
- 系统 Maven 为 `3.9.14`。
- 系统 Java 为 Java 26，而项目编译目标为 Java 11；与 Spring Boot 2.7.13 的完整构建兼容性需要实际验证。
- 端口 3000 和 8080 均没有现存服务。
- 后端首次启动会创建 `./data/toolmanager` 并初始化 H2 数据库，因此在严格只读检查中不应启动。

## 5. 应用入口与整体结构

```text
index.html
└─ index.tsx
   └─ App.tsx
      └─ HashRouter
         ├─ /login → Login
         └─ / → Layout
            ├─ Sidebar（顶部品牌区、用户区和横向 Mega Menu）
            └─ Outlet
               └─ pages/* 具体页面
                  ├─ components/* 公共组件
                  ├─ services/* API、审计、解析、导入导出
                  └─ 后端 Controller → Service → Repository → H2/外部系统
```

关键文件：

- `index.html`：HTML 壳和 `#root`。
- `index.tsx`：React 挂载入口，启用了 `React.StrictMode`。
- `App.tsx`：应用组件、工作台和全部前端路由。
- `components/Layout.tsx`：认证检查、菜单加载和页面骨架。
- `components/Sidebar.tsx`：实际渲染顶部横向导航和 Mega Menu。
- `src/globals.css`：全局主题和通用覆盖规则。

路由使用 `HashRouter`，因此浏览器实际地址形如：

```text
http://localhost:3000/#/dashboard
```

## 6. 页面和公共组件目录

### 6.1 页面目录

```text
pages/
├─ admin/
│  ├─ IpConfig.tsx
│  ├─ PermissionManagement.tsx
│  ├─ RoleManagement.tsx
│  └─ UserManagement.tsx
├─ interface/
│  ├─ CodeGenerator.tsx
│  ├─ DocManagement.tsx
│  └─ MockPacketGenerator.tsx
├─ sync/
│  ├─ NacosSync.tsx
│  └─ OracleSync.tsx
├─ Announcement.tsx
├─ AuditLog.tsx
├─ ChangeStepCheck.tsx
├─ DiffTool.tsx
├─ DocRepository.tsx
├─ FieldConfigTool.tsx
├─ FormatTools.tsx
├─ GiteeManagement.tsx
├─ GitlabReports.tsx
├─ Login.tsx
├─ MenuManagement.tsx
├─ ParameterConfig.tsx
├─ RefreshCache.tsx
├─ ReleaseChanges.tsx
└─ Suggestions.tsx
```

`pages/DiffTool.tsx` 当前没有在 `App.tsx` 注册路由，属于未启用页面。

### 6.2 公共组件

```text
components/
├─ Layout.tsx
├─ Sidebar.tsx
├─ Pagination.tsx
├─ ConfirmModal.tsx
├─ ErrorBoundary.tsx
├─ ImageViewer.tsx
├─ CodeViewer.tsx
├─ PDFViewer.tsx
└─ MarkdownViewer.tsx
```

- `Pagination`：统一每页条数、页码、上一页/下一页交互。
- `ConfirmModal`：通用危险、警告、信息确认弹窗。
- `ErrorBoundary`：目前主要保护知识库预览组件，不是应用级错误边界。
- `ImageViewer`、`CodeViewer`：知识库文件预览。
- `PDFViewer`、`MarkdownViewer` 目前未被 `DocRepository.tsx` 使用。
- `ConfigDiffViewer.tsx` 被 Nacos 页面复用，但目前位于项目根目录而不是 `components/`。

## 7. 路由与五个一级功能栏

路由集中定义于 `App.tsx`，菜单数据由后端动态返回。`SecurityDataInitializer` 当前初始化以下五个一级功能栏。

### 7.1 工作台

| 菜单 | 路由 | 页面入口 | 功能与数据来源 |
|---|---|---|---|
| 仪表盘 | `/dashboard` | `App.tsx` 内的 `Dashboard` | 工作概览、快捷入口、最新公告；使用 `announcementApi.checkStatus()` 和 `recordView()` |
| 公告通知 | `/announcement` | `pages/Announcement.tsx` | 公告列表、发布、更新、附件预览；使用 `announcementApi`、XLSX、Mammoth、审计服务 |
| 优化建议 | `/suggestions` | `pages/Suggestions.tsx` | 建议提交、搜索、分页；使用 `suggestionApi`、IP 映射、`Pagination` |

### 7.2 研发工具

| 菜单 | 路由 | 页面入口 | 功能与数据来源 |
|---|---|---|---|
| 接口文档 | `/interface/docs` | `pages/interface/DocManagement.tsx` | 本地/远程项目解析、接口信息、上下游调用链；使用 `xmlParser`、`docManagementApi`、`configApi` 及部分 Gitee/Nacos 接口 |
| 代码生成 | `/interface/code` | `pages/interface/CodeGenerator.tsx` | XML/Java 代码生成、Excel 导入导出、模板管理；使用 `xmlParser`、`excelImportExport`、`configApi`、`remoteCodeService` |
| 模拟报文 | `/interface/mock-packet` | `pages/interface/MockPacketGenerator.tsx` | Oracle 配置、交易类型加载、JSON 报文生成；使用 `mockPacketApi` |
| XML 报文生成 | `/field` | `pages/FieldConfigTool.tsx` | 浏览器内字段录入与 XML/Java 生成；主要是本地 React 状态 |
| 数据格式化 | `/format` | `pages/FormatTools.tsx` | JSON/XML/Java 对象格式化；使用 `javaObjectParser`，无后端 API |
| 知识库 | `/repo` | `pages/DocRepository.tsx` | 文档、版本、搜索、上传、下载和多格式预览；使用 `documentApi`、`ConfirmModal`、`ErrorBoundary`、`ImageViewer`、`CodeViewer` |

### 7.3 交付协同

| 菜单 | 路由 | 页面入口 | 功能与数据来源 |
|---|---|---|---|
| 变更集录入 | `/release-changes/dev` | `pages/ReleaseChanges.tsx`，`mode="developer"` | 上线版本下的开发变更集和文件录入；使用 `releaseChangeApi` |
| 比包对账 | `/release-changes/manager` | `pages/ReleaseChanges.tsx`，`mode="manager"` | 导入比包差异、责任人查询和确认；使用 `releaseChangeApi` |
| 变更步骤检查 | `/release-changes/check` | `pages/ChangeStepCheck.tsx` | Word 文档密码风险扫描、人工核查、历史和规则配置；使用 `changeStepCheckApi` |
| GitLab 报表 | `/gitlab-reports` | `pages/GitlabReports.tsx` | 项目、议题、合并请求查询和 Excel 导出；浏览器直接访问 GitLab `/api/v4`，配置使用 `configApi` |
| Gitee 仓库 | `/gitee` | `pages/GiteeManagement.tsx` | 分支、提交、变更集、对比及导出；使用后端 `/api/gitee/*`、`configApi`、`Pagination` |

### 7.4 运维配置

| 菜单 | 路由 | 页面入口 | 功能与数据来源 |
|---|---|---|---|
| Nacos 配置同步 | `/sync/nacos` | `pages/sync/NacosSync.tsx` | 连接配置、配置同步和详细差异；使用 `nacosApi`、`ConfigDiffViewer`、ExcelJS |
| Oracle DDL 同步 | `/sync/oracle` | `pages/sync/OracleSync.tsx` | 数据库连接、结构对比、DDL 生成与执行；使用 `dbConnectionApi`、`/api/oracle-sync/*`、`ConfirmModal` |
| 参数配置 | `/params` | `pages/ParameterConfig.tsx` | 参数 CRUD、分类、筛选、分页和 Excel 导入导出；使用 `systemParameterApi`、`Pagination`、`ConfirmModal` |
| 刷新缓存 | `/refresh` | `pages/RefreshCache.tsx` | 按环境和应用查询、刷新缓存；使用 `/api/apps/qryList`、`/api/apps/refresh` |

### 7.5 治理与系统

| 菜单 | 路由 | 页面入口 | 功能与数据来源 |
|---|---|---|---|
| 审计日志 | `/audit` | `pages/AuditLog.tsx` | 审计日志搜索、设备/IP 名称解析、分页；使用 `auditService`、`Pagination` |
| 用户管理 | `/admin/users` | `pages/admin/UserManagement.tsx` | 用户 CRUD、状态、角色和密码重置；使用 `userApi`、`roleApi` |
| 角色管理 | `/admin/roles` | `pages/admin/RoleManagement.tsx` | 角色 CRUD、状态和菜单绑定；使用 `roleApi`、`menuApi` |
| 权限管理 | `/admin/permissions` | `pages/admin/PermissionManagement.tsx` | 以角色为单位分配菜单/按钮权限；使用 `roleApi`、`menuApi` |
| 菜单管理 | `/admin/menus` | `pages/MenuManagement.tsx` | 菜单 CRUD、排序、启停和权限标识；使用 `menuApi` |
| IP 映射配置 | `/admin/ip-config` | `pages/admin/IpConfig.tsx` | IP 到显示名称的映射、Excel 导入；使用 `auditService` 和 `/api/ip-mappings` |

## 8. 动态菜单机制

- `Layout.tsx` 登录后调用 `menuApi.getTree()`，对应 `/api/menus/tree`。
- 菜单每 5 秒重新加载一次。
- 菜单管理页会触发 `menuUpdated` 和 `menuNameChanged` 事件，要求立即刷新导航。
- `MenuService.getMenusByUserId()` 根据当前用户角色关联的 `sys_menu` 记录构建树。
- `Sidebar.tsx` 将可见根菜单渲染为横向功能栏。
- 有子节点的功能栏显示 Mega Menu；叶子菜单直接导航。
- 当前菜单 `icon` 字段会保存并返回，但 `Sidebar` 没有渲染菜单图标，只显示文字和展开箭头。

后端同时存在两套菜单模型：

- `sys_menu`：带角色、权限、按钮标识，是 `/api/menus/tree` 的实际来源。
- `menu_items`：兼容旧导航结构，`SecurityDataInitializer.initFrontendMenuItems()` 会在启动时重建。

新增菜单时应优先保证 `sys_menu` 和角色关系正确；是否继续维护 `menu_items` 需结合现有兼容需求决定。

## 9. API 请求层

### 9.1 统一请求

`services/apiService.ts` 中：

- 优先使用 `import.meta.env.VITE_API_URL`。
- 本地 3000/5173 端口会自动使用 `http://当前主机:8080/api`。
- 单服务部署使用相对 `/api`。
- `fetchWithAuth()` 从 `localStorage` 读取 `accessToken`。
- 请求头使用 `Authorization: Bearer <token>`。
- 请求设置 `credentials: 'include'`。

主要 API 分组：

- `announcementApi`
- `menuApi`
- `systemParameterApi`
- `changeStepCheckApi`
- `suggestionApi`
- `releaseChangeApi`
- `configApi`
- `docManagementApi`
- `mockPacketApi`
- `dbConnectionApi`
- `codeTemplateApi`
- `documentApi`
- `documentCategoryApi`
- `nacosApi`

`services/authService.ts` 另外封装：

- `authApi`
- `userApi`
- `roleApi`
- `menuApi`

`services/auditService.ts` 维护一套独立但相似的认证请求封装。

### 9.2 需要注意的不一致

部分页面直接使用原始 `fetch()`：

- `GiteeManagement.tsx` 请求 `/api/gitee/*`。
- `DocManagement.tsx` 请求部分 `/api/gitee/*` 和 `/api/nacos-sync/*`。
- `OracleSync.tsx` 请求 `/api/oracle-sync/*`。
- `RefreshCache.tsx` 请求 `/api/apps/*`。
- `GitlabReports.tsx` 直接访问外部 GitLab Host。

其中 Gitee 和 DocManagement 的部分后端请求没有附带 `Authorization`。按照当前 `JwtAuthenticationInterceptor` 对 `/api/**` 的配置，这些调用可能返回 401，实际行为需要启动后确认。

新增页面应优先复用统一请求封装，避免复制新的原始 `fetch` 和 Token 处理逻辑。

## 10. 状态和持久化

- 页面业务状态主要由 `useState` 管理。
- 派生列表、筛选、分页使用 `useMemo`。
- 初始化、轮询和副作用使用 `useEffect`。
- 没有全局 Store。
- 登录信息保存在：
  - `localStorage.accessToken`
  - `localStorage.refreshToken`
  - `localStorage.user`
  - `localStorage.userInfo`
- Gitee、GitLab、代码模板和远程代码等模块还会将配置或缓存写入 LocalStorage。
- `services/database.ts` 是旧代码兼容层，以 Repository 风格读写 LocalStorage。
- 某些页面在 API 失败时会回退到 LocalStorage 或演示数据。例如参数配置会回退到 `mockParams`，这可能掩盖真实后端错误。

## 11. 认证、权限与 IP 控制

### 11.1 登录认证

- `Layout.tsx` 只检查 LocalStorage 中是否同时存在 `user` 和 `accessToken`，否则跳转 `/login`。
- 后端 `JwtAuthenticationInterceptor` 拦截 `/api/**`。
- 排除路径包括登录、退出和刷新 Token。
- JWT 中保存用户 ID、用户名和 Token 类型。
- `authApi.refreshToken()` 已实现，但没有发现自动刷新和统一 401 重定向机制。
- README 所述 HttpOnly Cookie 与当前实现不一致；实际主要使用 LocalStorage JWT。

### 11.2 角色和菜单权限

- 用户与角色通过 `sys_user_role` 关联。
- 角色与菜单通过 `sys_role_menu` 关联。
- 登录响应包含 `roles` 和 `permissions`。
- `authApi.hasPermission()` 和 `hasRole()` 已实现。
- 当前页面没有调用 `hasPermission()` 做按钮控制。
- 没有发现 `@PreAuthorize`、`@Secured` 或 `@RolesAllowed`。

因此当前权限更接近“菜单可见性控制”：

- 用户只能在导航中看到角色获权的菜单。
- 但已登录用户直接输入已注册路由仍可能进入页面。
- 后端业务接口通常只要求有效 JWT，没有逐权限标识校验。

若新增功能涉及敏感数据或危险操作，仅隐藏菜单是不够的，应补充后端授权。

### 11.3 IP 白名单

- `WebConfig` 将 `IpWhitelistConfigInterceptor` 注册到 `/**`。
- 白名单来自应用启动目录的 `config/whiteList.txt`。
- 文件存在至少一条有效规则时启用。
- 静态资源和 `/error` 被排除。
- `config/whiteList.txt` 当前包含本机和常见内网网段规则。
- 后台“IP 映射配置”只负责把 IP 显示为人员/设备名称，不参与访问控制。

## 12. 审计机制

- `App.tsx` 启动时调用 `initializeAuditButtonTracking()`。
- `services/auditButton.ts` 使用捕获阶段的全局点击监听，自动记录符合条件的按钮。
- `services/auditConfig.ts` 排除关闭、取消、分页、展开等低价值按钮。
- 重要业务操作还会显式调用 `recordAction(action, details)`。
- 新页面应在 `auditButton.ts` 的 `getCurrentPageName()` 中加入路由映射，否则自动审计可能把页面归类为“系统”。
- 新增、删除、导入、导出、执行、同步等关键业务动作建议保留显式语义化审计。

注意：开发模式启用 `React.StrictMode`，而 `initializeAuditButtonTracking()` 没有返回清理函数。是否会在开发环境重复注册监听、造成重复按钮审计，需要实际验证。

## 13. 视觉与交互规范

### 13.1 整体布局

- 页面背景为浅蓝灰渐变。
- 顶部品牌区高度约 64px，导航区约 48px，总高度约 112px。
- 主内容常用 `max-w-7xl`、`max-w-[1440px]` 或 `max-w-[1520px]`。
- 页面常用 `p-6` 或 `p-8`，模块间距常用 `gap-4`、`gap-6`。
- 大多数页面没有统一面包屑，使用顶部导航高亮和页面标题定位。

### 13.2 颜色

- 主色：Blue 700，约 `#1d4ed8`。
- 深色标题：Blue 950，约 `#172554`。
- 正文：Slate 600/700。
- 背景：`#f5f8fd`、`#f6f9ff`、白色半透明卡片。
- 成功：Emerald。
- 警告：Amber。
- 危险和删除：Red。

### 13.3 字体和字号

- 字体栈：Inter、系统无衬线字体、Segoe UI。
- 普通页面标题多为 `text-2xl`（24px）。
- 强调型工作流页面可用 `text-3xl`（30px）。
- 普通正文多为 `text-sm`（14px）。
- 标签、辅助信息和徽标多为 `text-xs`（12px）。

### 13.4 卡片、表格和表单

- 卡片通常是白底、浅蓝/Slate 边框、轻量蓝色阴影。
- 全局 CSS 会把 `rounded-xl`、`rounded-2xl` 和自定义大圆角压为 8px。
- 表格使用浅蓝表头 `#edf4ff`，标题为深蓝，行悬停为浅蓝。
- 表格单元格常用 `px-6 py-3` 或 `px-6 py-4`。
- 输入框常见模式：
  - 浅灰蓝背景 `#f8fafc`
  - Slate 边框
  - 聚焦后白底、Blue 边框和浅蓝 focus ring
- 页面内经常把输入样式保存为 `INPUT_STYLE` 常量，但该常量在多个页面重复定义，并非真正公共组件。

### 13.5 按钮

- 主操作：Blue 700 背景、白字。
- 次操作：白底、蓝边、蓝字。
- 导入/成功：绿色。
- 删除/高风险：红色。
- 禁用：降低透明度并使用 `cursor-not-allowed`。
- 图标统一来自 `lucide-react`，常见尺寸为 14–22px。

### 13.6 弹窗

- 使用 fixed 全屏遮罩。
- 遮罩为深蓝/Slate 半透明并带 `backdrop-blur-sm`。
- 内容为白色卡片，常见 `max-w-md`、`max-w-2xl`、`max-w-6xl`。
- 通常分标题区、可滚动内容区、底部操作区。
- 删除确认优先使用 `ConfirmModal`。

### 13.7 加载、空数据、错误和成功

- 加载：`Loader2` + `animate-spin`、加载文字或 `animate-pulse` 骨架。
- 空数据：表格占位行或虚线边框空状态卡。
- 错误：红色边框/浅红背景的行内提示。
- 成功：Emerald 状态卡或徽标。
- 旧页面大量使用浏览器 `alert()`，没有统一 Toast/Notification 组件。
- `ErrorBoundary` 目前只覆盖知识库的部分预览区域。

### 13.8 响应式

- 使用 Tailwind 的 `sm`、`md`、`lg`、`xl`、`2xl` 断点。
- 小屏通常由多列收缩为单列。
- 顶部导航允许窄屏横向滚动。
- `Pagination` 在小屏改为纵向排列并隐藏部分按钮文本。
- 复杂表格通常使用较大 `min-width` 和横向滚动。
- Oracle、知识库等页面仍存在固定宽度比例和固定高度，移动端属于部分适配。

### 13.9 主题和样式来源

- 唯一源 CSS 文件是 `src/globals.css`。
- `tailwind.config.js` 的 `theme.extend` 为空，没有独立设计 Token。
- `FieldConfigTool.tsx`、`RefreshCache.tsx` 使用页面内 `<style>`，与 Tailwind 页面存在一定差异。
- 项目使用了 `animate-in`、`fade-in`、`zoom-in` 等类，但没有配置 `tailwindcss-animate` 插件，入场动画是否实际生效需要确认。

## 14. 推荐参考页面

### 14.1 变更步骤检查：视觉和工作流首选

文件：`pages/ChangeStepCheck.tsx`

适合作为参考的原因：

- 使用近期统一的蓝白视觉体系。
- 有规范的渐变标题操作区。
- 覆盖拖拽上传、加载、错误、空结果、成功状态。
- 有统计卡片、徽标、风险列表、历史表格和配置弹窗。
- 响应式处理相对完整。
- API 和 TypeScript 类型边界清楚。

相关文件：

- `services/apiService.ts` 中的 `changeStepCheckApi`
- `types.ts` 中的 `ChangeStep*` 类型
- `backend/src/main/java/com/toolmanager/controller/ChangeStepCheckController.java`
- `backend/src/main/java/com/toolmanager/service/ChangeStepCheckService.java`
- 对应 Repository 和后端测试

### 14.2 参数配置：列表 CRUD 首选

文件：`pages/ParameterConfig.tsx`

适合作为参考的原因：

- 包含顶部操作区、内联新增、筛选和搜索。
- 包含表格内编辑、分页、导入导出。
- 包含分类管理弹窗和删除确认。
- 复用了 `Pagination`、`ConfirmModal`。
- 适合管理后台常见的配置和数据维护页面。

相关文件：

- `components/Pagination.tsx`
- `components/ConfirmModal.tsx`
- `services/apiService.ts` 中的 `systemParameterApi`
- `types.ts` 中的 `ParameterConfig`
- `SystemParameterController/Service/Repository`

新增页面建议以 `ChangeStepCheck.tsx` 作为视觉基线，以 `ParameterConfig.tsx` 作为 CRUD 结构基线。

## 15. 新增功能页面的典型扩展点

### 15.1 前端页面和类型

- 新建 `pages/<业务域>/<NewPage>.tsx`。
- 可复用的数据结构放在 `types.ts`。
- 页面优先使用现有布局、颜色、间距、表格和状态规范。

### 15.2 路由

- 在 `App.tsx` 导入页面。
- 在 `Layout` 子路由下增加 `<Route>`。
- 路径应和后端菜单中的 `path` 完全一致。

### 15.3 菜单

- 在 `SecurityDataInitializer` 中将菜单加入适当的一级业务域。
- 定义名称、路径、图标标识、权限标识、父菜单、排序、菜单/按钮类型和状态。
- 管理员启动时会获得全部菜单。
- 普通角色需通过权限管理页面分配。
- 若继续兼容 `menu_items`，还需要考虑 `initFrontendMenuItems()`。

### 15.4 API

- 前端优先扩展 `services/apiService.ts`。
- 认证、用户、角色、菜单相关接口放在 `services/authService.ts`。
- 避免新页面直接复制 `fetchWithAuth`。
- 避免未经统一处理的 `/api/*` 原始 `fetch`。

### 15.5 后端

按需求可能新增：

```text
backend/src/main/java/com/toolmanager/
├─ controller/*Controller.java
├─ service/*Service.java
├─ dto/*Dto.java
├─ entity/*.java
└─ repository/*Repository.java
```

如果需要持久化，还应检查：

- `backend/src/main/resources/schema.sql`
- `backend/src/main/resources/migration.sql`
- `backend/src/main/resources/init-data.sql`
- JPA `ddl-auto=update` 对目标环境的影响

### 15.6 权限

- 定义页面权限，如 `module:view`。
- 定义按钮权限，如 `module:add`、`module:edit`、`module:delete`。
- 在角色权限页面完成分配。
- 敏感功能应补充后端授权，而不仅是菜单隐藏。

### 15.7 审计

- 在 `services/auditButton.ts#getCurrentPageName` 添加页面路径映射。
- 对新增、修改、删除、执行、同步、导入导出等操作调用 `recordAction()`。
- 按钮若不应记录，可通过 `data-audit-exclude="true"` 或审计配置排除。

### 15.8 国际化

- 当前没有 i18n 框架和语言资源文件。
- 中文文案直接写在 TSX 中。
- 若新页面要求多语言，需要先确定是否将国际化建设纳入范围。

### 15.9 测试

- 后端测试放在 `backend/src/test/java/com/toolmanager/...`。
- 现有测试集中在变更步骤检查和上传配置。
- 前端没有自动化测试基础设施；若要求前端单元/组件测试，需要单独引入并配置。

## 16. 开发前需要明确的信息

正式实现新增页面前，需要明确：

1. 页面名称、所属一级功能栏和目标路由。
2. 菜单排序、菜单图标标识和权限标识。
3. 页面属于列表 CRUD、配置表单、文件处理、报表还是多步骤工作流。
4. 字段、校验、筛选、分页、导入导出和操作流程。
5. 数据来自现有 API、新后端表、外部系统还是纯前端计算。
6. 哪些角色可访问，哪些操作需要按钮级权限。
7. 是否要求后端端点级授权。
8. 是否需要移动端、大屏、多语言和前端自动化测试。
9. 是否允许顺带修复新页面会触及的统一请求/JWT问题。

## 17. 实施建议

- 先确定业务域、路由、权限和 API 契约，再开始页面代码。
- 视觉优先复用 `ChangeStepCheck.tsx` 的页面骨架。
- 数据列表优先复用 `ParameterConfig.tsx`、`Pagination` 和 `ConfirmModal`。
- 新 API 应进入统一请求层并自动附加 JWT。
- 不应根据菜单可见性假定后端已经完成授权。
- 新页面应同时处理加载、空数据、错误、成功和禁用状态。
- 复杂表格应提供横向滚动，并至少验证桌面和窄屏布局。
- 关键业务动作应记录语义化审计日志。
- 实现完成后至少执行 TypeScript 构建、后端测试和目标路由手工冒烟验证。
