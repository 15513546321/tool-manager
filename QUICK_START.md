# 快速参考指南

## 文档导航

| 文档 | 用途 | 适用场景 |
|------|------|--------|
| **README.md** | 项目总览 | 第一次了解项目 |
| **MANUAL.md** ⭐ | 用户手册 | 学习使用功能 |
| **IMPLEMENTATION.md** | 实现详解 | 了解技术细节 |
| **DEPLOYMENT.md** | Windows部署 | Windows环境部署 |
| **LINUX_DEPLOYMENT.md** | Linux部署 | Linux环境部署 |
| **DATA_INTERACTION.md** | 数据交互 | 理解API接口 |
| **GEMINI.md** | 特殊说明 | 查看特定配置 |
| **BUG_TEST_REPORT.md** | 测试报告 | 查看已修复Bug |
| **CHILD_NODE_PASTE_FIX.md** | 粘贴修复 | 了解粘贴逻辑 |

---

## 常用命令

### 开发环境

```bash
# 安装依赖
npm install

# 前端开发模式 (热更新)
npm run dev

# 前端生产构建
npm run build

# 类型检查
npm run type-check
```

### 后端开发

```bash
cd backend

# 构建 JAR
mvn clean package -DskipTests

# 运行JAR
java -jar target/tool-manager-backend-1.0.0.jar

# 开发模式 (需IDE支持)
mvn spring-boot:run
```

### 快速启动脚本

```bash
# 完整应用（前端+后端）
.\start.ps1

# 仅后端
.\start-backend.ps1

# 简化版
.\start-simple.ps1
```

---

## 功能速查

### 接口管理 (Interface Designer)

**创建接口**
1. 填写 Transaction ID
2. 选择 Template
3. 定义 Request 参数
4. 定义 Response 参数
5. 点击 Generate Code

**导入数据方式**
- Excel 导入: 点击 **导入** 按钮
- 复制粘贴: 从表格复制 TAB 分隔数据后粘贴
- 批量导入: 支持一次导入多个接口配置

**导出数据方式**
- 当前参数: 点击 **导出** 导出为 Excel
- 完整配置: 点击 **导出完整配置** (XML+Java)
- 下载模板: 获取标准 Excel 格式模板

### 容器操作

```
Array/Object 容器字段：
  ├─ 点击 + 按钮添加子字段
  ├─ 点击 - 按钮删除子字段
  ├─ 支持无限层级嵌套
  └─ 粘贴自动适配为容器子项
```

### 代码生成

**XML Config**
- 用于接口配置文件
- 可直接复制到项目中
- 包含所有字段定义和属性

**Java Class**
- Action 实现框架代码
- 需补充业务逻辑
- 自动生成导包和基础结构

---

## 文件结构速览

```
tool-manager/
├── src/
│   ├── pages/interface/
│   │   ├── CodeGenerator.tsx      # 接口设计编辑器
│   │   ├── DocManagement.tsx      # 文档管理
│   │   └── CodeGenerator.tsx      # 代码生成器
│   └── services/
│       ├── xmlParser.ts           # XML/Java生成
│       ├── excelImportExport.ts   # Excel处理
│       └── apiService.ts          # API调用
├── backend/
│   └── src/main/java/com/toolmanager/
│       ├── controller/            # API接口
│       ├── service/               # 业务逻辑
│       ├── repository/            # 数据访问
│       └── entity/                # 数据模型
├── MANUAL.md                      # 用户手册 ⭐
├── IMPLEMENTATION.md              # 实现详解
├── DEPLOYMENT.md                  # 部署指南
└── README.md                      # 项目总览
```

---

## 常见操作流程

### 完整的接口定义流程

```
1️⃣  点击 + Add Root Field
    ↓
2️⃣  填写字段信息 (Type, Name, Description, Style)
    ↓
3️⃣  需要复杂结构？
    ├─ 是 → Type改为Array/Object → 点击+添加子字段
    └─ 否 → 继续填写其他字段
    ↓
4️⃣  全部字段定义完成 → 点击Generate Code
    ↓
5️⃣  查看生成的XML和Java代码
    ↓
6️⃣  复制代码 → 粘贴到项目中
```

### 从Excel导入字段

```
1️⃣  点击 下载模板
    ↓
2️⃣  用Excel打开模板，填写字段信息
    格式示例:
    userId    string   用户ID         NotNullStyle
    users     array    用户列表       
    - id      string   用户ID         
    - name    string   用户名         
    ↓
3️⃣  保存Excel文件
    ↓
4️⃣  点击 导入，选择文件
    ↓
5️⃣  系统自动解析并创建字段树
```

### 修改Template

```
1️⃣  点击 Template 旁的 ⚙️ 图标
    ↓
2️⃣  在弹出的模态框中操作:
    ├─ 新增: 输入名称 → 点击+ 添加
    ├─ 修改: 点击 编辑 → 修改 → 更新
    └─ 删除: 点击 删除 (保留至少1个)
    ↓
3️⃣  修改后的Template会影响新建接口
```

---

## 数据验证规则

### Transaction ID
- ✅ 必须输入，不能为空
- ✅ 必须以字母开头
- ✅ 仅支持字母和数字
- ❌ 不支持特殊符号或空格
- 示例: `userQuery`, `orderSubmit`, `PaymentCheck`

### 字段Name
- ✅ 必须输入，不能为空
- ✅ 支持英文字母、数字、下划线
- ✅ 通常采用驼峰式命名
- 示例: `userId`, `userName`, `createTime`

### 粘贴数据量
- ⚠️ 单次最多 500 行
- 💡 超过限制请分多次粘贴或使用 Excel 导入

---

## 故障排查

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| 粘贴失败 | 剪贴板数据格式不对 | 确保用TAB分隔列，回车分隔行 |
| 导入失败 | Excel格式错误 | 使用 **下载模板** 获取标准格式 |
| 代码生成失败 | Transaction ID为空或格式错误 | 检查ID是否以字母开头 |
| 子字段为空 | 未添加子字段 | 点击 **+Add** 按钮添加 |
| 界面崩溃 | 粘贴数据过多 | 减少粘贴数据量（< 500行） |

---

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+S` | 保存接口配置 |
| `Ctrl+V` | 粘贴字段数据 |
| `Ctrl+C` | 复制生成的代码 |
| `Tab` | 粘贴时的列分隔符 |
| `Enter` | 粘贴时的行分隔符 |

---

## 联系方式与支持

- 📖 完整文档: [MANUAL.md](MANUAL.md)
- 🔧 实现细节: [IMPLEMENTATION.md](IMPLEMENTATION.md)
- 🐛 已知问题: [BUG_TEST_REPORT.md](BUG_TEST_REPORT.md)
- 📋 部署说明: [DEPLOYMENT.md](DEPLOYMENT.md) / [LINUX_DEPLOYMENT.md](LINUX_DEPLOYMENT.md)

---

## 更新记录

### v2.1.2 (当前版本)
- ✅ 修复Array/Object容器子节点粘贴逻辑
- ✅ 添加Transaction ID验证
- ✅ 完善Excel导入字段名处理
- ✅ 粘贴数据量限制（最多500行）
- ✅ 整合文档，删除冗余markdown

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
