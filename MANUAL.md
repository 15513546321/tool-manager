# Tool Manager 用户手册

## 📖 目录
1. [快速开始](#快速开始)
2. [功能特性](#功能特性)
3. [使用指南](#使用指南)
4. [部署指南](#部署指南)
5. [常见问题](#常见问题)

---

## 快速开始

### 环境要求
- **Node.js**: v16+ 
- **Java**: JDK 11+
- **Maven**: 3.6+
- **数据库**: H2 或 Oracle（可选）

### 本地开发启动

```bash
# 1. 启动前端开发服务器
npm install
npm run dev

# 2. 启动后端服务（另一个终端）
cd backend
mvn clean package -DskipTests
java -jar target/tool-manager-backend-1.0.0.jar
```

前端访问: http://localhost:5173  
后端API: http://localhost:8080

### 生产构建

```bash
npm run build
# 输出文件在 backend/src/main/resources/static/
```

---

## 功能特性

### 1. 接口管理 (Interface Designer)

**核心功能**:
- ✅ **图形化接口设计**: 使用表格式编辑器定义请求和响应字段
- ✅ **字段类型支持**: field、string、date、array、object 五种类型
- ✅ **容器嵌套**: Array/Object 类型支持无限层级嵌套
- ✅ **批量操作**: 
  - 复制粘贴字段（支持跨容器）
  - Excel 导入导出
  - 批量导入多个接口配置
- ✅ **代码生成**: 自动生成 XML 配置和 Java Action 类
- ✅ **Template 管理**: 创建、修改、删除接口模板

**关键特性**:
- **智能粘贴**: 粘贴到不同位置自动适应（根级、容器、嵌套子项）
- **自动展开**: 修改字段类型为容器时自动展开便于编辑
- **类型验证**: 生成代码前验证 Transaction ID 合法性
- **数据保护**: 粘贴超过 500 行自动提示并拒绝，防止性能问题

### 2. 文档管理 (Doc Management)

**功能**:
- 📄 从本地 Java/XML 项目导入接口配置
- 📊 导出为 Excel 文档（含摘要、参数详情、代码模板等）
- 🔍 交互式字段编辑与层级展示
- 💾 与后端数据库同步

### 3. 其他工具

| 功能 | 说明 |
|------|------|
| **菜单管理** | 创建和管理系统菜单，支持权限控制 |
| **参数配置** | 系统全局参数配置与热更新 |
| **公告管理** | 发布系统通知和维护公告 |
| **格式工具** | XML、JSON 格式化与转换 |
| **数据同步** | 支持 Nacos、Oracle 数据源同步 |
| **Gitlab/Gitee** | 代码库集成与分析 |
| **审计日志** | 操作记录与安全追踪 |

---

## 使用指南

### 接口设计完整流程

#### 第1步: 创建新接口

1. 进入 **接口管理** → **Interface Designer**
2. 在 Transaction ID 输入框输入接口ID（如 `userQuery`）
3. 选择 Template（默认 `ExecuteLogTemplate`）
4. 填写接口描述

#### 第2步: 定义请求参数 (Request)

**方式1: 手动输入**
1. 切换到 **Request** 标签
2. 点击下方 **+ Add Root Field** 添加字段
3. 逐一填写：
   - Type: 选择字段类型
   - Name: 字段名（英文，如 `userId`）
   - Description: 字段描述
   - Style: 验证规则（如 `NotNullStyle`）

**方式2: Excel 导入**
1. 点击 **下载模板** 下载 Excel 模板
2. 在 Excel 中填写字段信息（可包含数组/对象子项）
3. 点击 **导入** 上传 Excel 文件

**方式3: 批量导入**
1. 点击 **批量模板** 下载多接口导入模板
2. 填写多个接口的配置
3. 点击 **批量导入** 上传文件

**方式4: 复制粘贴**
1. 从 Excel 或其他表格复制数据（TAB 分隔）
2. 在字段表中的 Name 列粘贴
3. 系统自动识别并创建字段

```
示例粘贴格式:
userId	string	用户ID	NotNullStyle
userName	string	用户名	
userList	array	用户列表	
- id	string	用户ID	
- name	string	用户名	
```

#### 第3步: 定义Array/Object容器

1. 在字段类型 (Type) 列选择 **Array** 或 **Object**
2. 系统自动初始化 children 属性并展开
3. 点击 **+Add** 按钮向容器中添加子字段
4. 可继续嵌套创建多层容器结构

**示例**: 创建分页响应结构
```
data         array   返回数据列表
  - id       string  对象ID
  - name     string  对象名称
  - info     object  详细信息
    - desc   string  描述信息
    - tags   array   标签列表
pageInfo     object  分页信息
  - total    string  总数
  - current  string  当前页
```

#### 第4步: 定义响应参数 (Response)

1. 切换到 **Response** 标签
2. 重复第2-3步操作
3. 通常包含：
   - 状态码 (code)
   - 消息 (message)
   - 数据 (data，通常为 array/object)

#### 第5步: 生成代码

1. 确保 Transaction ID、Template、Request/Response 都已配置
2. 点击 **Generate Code** 按钮
3. 在下方预览区查看生成的：
   - **XML Config**: 接口配置文件（可直接复制到项目）
   - **Java Class**: Action 类代码（需根据业务逻辑补充）
4. 点击复制按钮可复制到剪贴板

### 高级操作

#### 导出为 Excel

1. 点击 **导出** 将当前 Request/Response 导出为 Excel
2. 可用于文档存档或与其他工具集成

#### 编辑已存在的接口

1. **从 Doc Management 导入**: 上传 Java/XML 项目，自动识别所有接口
2. **批量编辑**: 使用批量导入功能修改多个接口配置
3. **复制粘贴**: 选中现有字段复制后粘贴到其他接口

#### 创建 Template 模板

1. 点击 **Template** 旁边的 **⚙️** 图标打开 Template 管理
2. **新增模板**: 输入模板名称，点击 **+ 添加**
3. **修改模板**: 点击模板旁的 **编辑** 按钮
4. **删除模板**: 点击模板旁的 **删除** 按钮

---

## 部署指南

### Windows 部署

#### 自动启动脚本

项目根目录提供了快速启动脚本：

```bash
# 运行完整应用（前端+后端）
.\start.ps1

# 仅运行简化版（轻量级）
.\start-simple.ps1

# 仅启动后端
.\start-backend.ps1
```

#### 手动部署步骤

1. **构建前端**
   ```bash
   npm install
   npm run build
   ```

2. **构建后端**
   ```bash
   cd backend
   mvn clean package -DskipTests
   ```

3. **运行应用**
   ```bash
   # 后端会自动提供前端页面（http://localhost:8080）
   java -jar backend/target/tool-manager-backend-1.0.0.jar
   ```

### Linux 部署

详见 [Linux 部署手册](LINUX_DEPLOYMENT.md)

### Docker 部署 (可选)

```dockerfile
# 构建镜像
docker build -t tool-manager:1.0 .

# 运行容器
docker run -d -p 8080:8080 --name tool-manager tool-manager:1.0
```

### 数据库配置

**H2 (默认，适用于开发)**
- 自动创建，无需配置
- 数据存储在 `data/` 目录

**Oracle (生产环境)**
1. 修改 `backend/src/main/resources/application.properties`:
   ```properties
   spring.datasource.url=jdbc:oracle:thin:@host:1521:orcl
   spring.datasource.username=your_username
   spring.datasource.password=your_password
   ```
2. 重新编译和部署

---

## 常见问题

### Q1: 粘贴数据时提示 "粘贴数据过多"
**A**: 系统限制单次粘贴最多 500 行，防止性能问题。可以：
- 分多次粘贴
- 使用 Excel 导入功能（支持更大数据量）

### Q2: 生成的代码出现编译错误
**A**: 常见原因：
- Transaction ID 不合法（必须以字母开头，仅支持字母和数字）
- Java 代码模板中的类名和 package 需要根据项目修改
- 需要添加所需的依赖和导入

### Q3: Array/Object 字段中的子字段为空
**A**: 检查：
- 是否已点击 **+Add** 按钮添加子字段
- 子字段的 Name 是否为空（Name 为空的行会被跳过）

### Q4: 导入 Excel 时字段识别错误
**A**: 确保 Excel 格式正确：
- 第一行应该是表头（字段名、类型、描述、样式）
- 使用 **下载模板** 获取标准格式
- 数组/对象子项应在前一行下方，且 Name 以 "- " 开头

### Q5: 如何删除已创建的接口
**A**: 当前版本中单个接口删除功能在优化中。可以：
- 手动删除所有字段（逐个点击删除按钮）
- 使用批量导入时选择覆盖策略
- 直接在数据库中删除对应记录

### Q6: Template 修改后为什么旧接口没有更新
**A**: Template 只是接口的模板标签，修改 Template 不会改变已有接口配置。修改后：
- 新创建的接口会使用新的 Template
- 已有接口保持不变

### Q7: Linux 上如何运行本系统
**A**: 详见本文档的 [Linux 部署](#linux-部署) 章节或单独的部署手册。

### Q8: 如何扩展支持更多字段类型
**A**: 修改以下文件：
- `types.ts`: 定义新的 XmlField 类型枚举
- `pages/interface/CodeGenerator.tsx`: 在 Type 选择框添加新类型
- `services/xmlParser.ts`: 修改 XML/Java 代码生成逻辑

---

## 技术架构

### 前端架构
- **框架**: React 18 + TypeScript
- **样式**: Tailwind CSS
- **构建**: Vite
- **数据处理**: XLSX (Excel 导入导出)
- **UI 组件**: Lucide Icons

### 后端架构
- **框架**: Spring Boot
- **数据库**: H2 + JPA
- **服务**: RESTful API
- **部署**: 内置 Tomcat

### 核心模块
1. **xmlParser.ts**: XML/Java 代码生成
2. **excelImportExport.ts**: Excel 导入导出
3. **CodeGenerator.tsx**: 接口设计编辑器
4. **database.ts**: 数据持久化层

---

## 更新日志

### v2.1.2
- ✅ 修复 Array/Object 容器内粘贴数据的路由问题
- ✅ 优化子节点粘贴逻辑，支持嵌套容器
- ✅ 添加粘贴数据量限制（防止性能问题）
- ✅ 增强 Transaction ID 验证
- ✅ 完善 Excel 导入字段名空值处理

### v2.1.0
- ✅ 新增 Template 管理功能
- ✅ 支持 Array/Object 自动初始化和展开
- ✅ 优化粘贴逻辑支持多种场景

---

## 许可证

MIT License - 详见 LICENSE 文件

---

## 支持

有问题或建议？
- 📧 联系技术支持
- 📝 提交 Issue 或 PR
- 💬 加入讨论组
