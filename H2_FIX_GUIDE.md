# H2 数据库文件版本不兼容 - 解决方案

## 错误信息
```
[90048] Unsupported database file version or invalid file header in file
"G:\vsCodeWorkSpace\tool-manager\backend\data\tooldb.mv.db" [90048-232]
```

## 原因分析

这个错误通常是由以下原因引起的：
1. **版本不匹配**：IDEA 中的 H2 驱动版本与 Spring Boot 中的 H2 版本不同
2. **文件损坏**：数据库文件被多个版本的 H2 打开过
3. **编码问题**：文件编码或格式不兼容

## 快速修复（3 步）

### 步骤 1：删除旧数据库文件

在 PowerShell 中执行：

```powershell
# 进入数据目录
cd G:\vsCodeWorkSpace\tool-manager\backend\data\

# 删除所有 H2 相关文件
Remove-Item tooldb.mv.db -ErrorAction SilentlyContinue
Remove-Item tooldb.trace.db -ErrorAction SilentlyContinue
Remove-Item tooldb.lock.db -ErrorAction SilentlyContinue

# 验证删除
dir
# 应该看到目录为空（或没有 tooldb 文件）
```

### 步骤 2：创建新的数据库

在 PowerShell 中执行：

```powershell
# 进入后端目录
cd G:\vsCodeWorkSpace\tool-manager\backend

# 方式 A：使用 Maven（推荐）
mvn spring-boot:run

# 或方式 B：如果 mvn 不在 PATH，在 IDEA 中
# 右键点击项目 → Run 或 Shift+F10

# 应该看到类似输出：
# Started ToolManagerBackendApplication in 5.234 seconds
# 说明应用启动成功

# 按 Ctrl+C 停止应用
```

### 步骤 3：在 IDEA 中重新连接数据库

1. **关闭当前连接**
   - 在 Database 面板，右键点击 `tooldb` → Disconnect

2. **刷新驱动**
   - 在 Database 面板，点击左上角的 `Drivers` 标签页
   - 找到 `H2` 驱动
   - 右键点击 → Update Driver（检查是否需要更新）

3. **重新连接**
   - 在 `tooldb` 数据源上右键 → Connect
   - 或按 Ctrl+Alt+Shift+U（刷新数据库）

4. **测试连接**
   - 点击 OK
   - 应该看到绿色的 ✓ 连接成功

---

## 详细排查步骤

### 检查 1：验证 H2 版本一致性

**在 IDEA 中查看 H2 驱动版本：**
1. Database 面板 → Drivers 标签页
2. 找到 H2 驱动
3. 查看版本号（如 2.1.214）

**在 pom.xml 中检查 H2 版本：**
```xml
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <!-- 版本号来自 Spring Boot 2.7.13 的默认版本 -->
</dependency>
```

Spring Boot 2.7.13 默认使用 H2 2.1.214。如果 IDEA 驱动版本不同，会导致兼容性问题。

### 检查 2：查看数据库文件信息

```powershell
# 查看文件大小和时间戳
Get-ChildItem G:\vsCodeWorkSpace\tool-manager\backend\data\

# 输出示例：
# Mode     LastWriteTime      Length Name
# ----     ---------------    ------ ----
# -a----   2024/12/11 10:30    12345 tooldb.mv.db

# 如果文件很小（< 1KB）或时间戳很久以前，说明数据库没有正确初始化
```

### 检查 3：确认 application.properties 配置

查看 `backend/src/main/resources/application.properties`：

```properties
# 应该包含这些配置
spring.datasource.url=jdbc:h2:file:./data/tooldb;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
spring.datasource.driverClassName=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=

spring.h2.console.enabled=true
spring.h2.console.path=/h2-console

spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=update
```

---

## 如果仍然出现问题

### 方案 A：使用 H2 Web 控制台（不依赖 IDEA 驱动）

```bash
# 1. 启动应用
cd backend
mvn spring-boot:run

# 2. 在浏览器访问 H2 Web 控制台
# http://localhost:8080/h2-console

# 3. 使用 Web 控制台管理数据库
# 输入连接信息：
# URL: jdbc:h2:file:./data/tooldb
# User: sa
# Password: (留空)
# 点击 Connect
```

### 方案 B：清空并重置数据库

```powershell
# 完全清除所有数据（谨慎操作）
Remove-Item G:\vsCodeWorkSpace\tool-manager\backend\data\ -Recurse -Force

# 重新创建目录
New-Item -ItemType Directory G:\vsCodeWorkSpace\tool-manager\backend\data\

# 启动应用自动创建新数据库
cd G:\vsCodeWorkSpace\tool-manager\backend
mvn spring-boot:run
```

### 方案 C：更新 IDEA H2 驱动

如果 IDEA 中的 H2 驱动版本太旧：

1. Database → Drivers 标签页
2. 右键 H2 → Download Missing Files
3. 或手动下载最新驱动：https://h2database.com/html/downloads-archive.html

---

## 验证修复成功

### 检查 1：应用日志
```
应该看到：
Initializing H2 Console...
Started ToolManagerBackendApplication in X.XXX seconds
```

### 检查 2：数据库文件
```powershell
# 文件应该存在且大小 > 10KB
Get-ChildItem G:\vsCodeWorkSpace\tool-manager\backend\data\tooldb.mv.db
```

### 检查 3：IDEA 连接
- Database 面板应该能看到 `tooldb` 下的表：
  ```
  AUDIT_LOGS
  IP_MAPPINGS
  ```

### 检查 4：Web 控制台
- 访问 http://localhost:8080/h2-console
- 应该能连接并看到表数据

---

## 预防措施

以后避免此问题：

1. **不要使用不同版本的 H2 客户端**
   - IDEA 驱动版本应与 pom.xml 中的版本一致

2. **不要让多个应用同时打开同一个 H2 文件**
   - 关闭 Web 控制台再用 IDEA 打开

3. **定期备份数据**
   ```powershell
   cp G:\vsCodeWorkSpace\tool-manager\backend\data\tooldb.mv.db G:\vsCodeWorkSpace\tool-manager\backend\data\tooldb.backup.$(date +%Y%m%d).mv.db
   ```

4. **生产环境使用专业数据库**
   - 将 H2 替换为 PostgreSQL 或 MySQL

---

## 联系支持

如果问题仍未解决，请提供：
1. IDEA 版本号
2. H2 驱动版本
3. Spring Boot 版本（已知是 2.7.13）
4. 完整的错误日志

---

**版本**：1.0  
**最后更新**：2024-12-11
