# 🗄️ H2 数据库远程连接指南

## 📋 概述

你的应用使用 H2 数据库存储连接配置。本指南提供了 **4 种连接方式**，帮助你远程访问和管理数据库。

---

## 🔧 修复的问题

### 问题：连接配置应用重启后加载不到

**原因分析：**
1. ✅ **已修复**：`DbConnectionService.save()` 方法现在添加了 `flush()` 确保数据立即持久化
2. ✅ **已修复**：H2 数据库连接参数添加了 `DB_CLOSE_ON_EXIT=FALSE`，确保数据库连接持续打开
3. ✅ **新增**：启用了 H2 TCP 服务器，支持远程连接和管理

---

## 📡 4 种连接方式

### 方式 1：嵌入式连接（应用内部使用）⚡

**最快速的连接方式**

```
协议: 嵌入式
JDBC URL: jdbc:h2:file:./data/toolmanager;MODE=MySQL;DB_CLOSE_DELAY=-1
用户名: sa
密码: (空)
```

**特点：**
- ✅ 最快速，应用内部使用
- ✅ 不需要额外启动服务
- ❌ 只能在应用内部访问

**使用场景：**
- 应用程序内部数据库操作

---

### 方式 2：Web 控制台（浏览器管理）🌐

**在浏览器中管理数据库**

```
URL: http://localhost:8080/h2-console
或
URL: http://your-ip:8080/h2-console
```

**连接参数：**
```
JDBC URL: jdbc:h2:file:./data/toolmanager;MODE=MySQL
用户名: sa
密码: (空)
```

**操作步骤：**
1. 启动应用
2. 在浏览器访问 `http://localhost:8080/h2-console`
3. 输入上面的 JDBC URL
4. 点击 "Connect"
5. 现在可以执行 SQL、查看表结构、导出数据等

**特点：**
- ✅ 可视化操作界面
- ✅ 支持 SQL 编辑器
- ✅ 支持数据导出
- ✅ 无需额外工具

**使用场景：**
- 快速查看表结构和数据
- 执行 SQL 语句
- 数据导出和备份

---

### 方式 3：TCP 远程连接（最推荐）🔌

**用于 IDE 和数据库工具远程连接**

```
协议: TCP (H2)
主机: localhost (或 your-server-ip)
端口: 9092
数据库文件: ./data/toolmanager
JDBC URL: jdbc:h2:tcp://localhost:9092/file:./data/toolmanager;MODE=MySQL
用户名: sa
密码: (空)
```

**支持的工具：**
- ✅ DBeaver（推荐）
- ✅ DataGrip（JetBrains）
- ✅ Navicat
- ✅ HeidiSQL
- ✅ SQLyog
- ✅ 其他支持 H2 的工具

#### 使用 DBeaver 连接

**DBeaver 是完全免费的数据库管理工具，推荐使用**

1. **安装 DBeaver**
   - 访问 https://dbeaver.io/download/
   - 下载并安装社区版

2. **创建新数据库连接**
   - 打开 DBeaver
   - Database → New Database Connection
   - 选择 "H2"（H2 Embedded 或 H2 Server）

3. **配置连接信息**
   ```
   连接类型: H2 Server (或 H2 Embedded)
   主机: localhost
   端口: 9092
   数据库: file:./data/toolmanager
   用户名: sa
   密码: (空)
   ```

4. **测试连接**
   - 点击 "Test Connection"
   - 应该显示 "Successfully" ✅

5. **连接成功后**
   - 可以查看所有表
   - 支持 SQL 编辑和执行
   - 支持数据导入导出

#### 使用 DataGrip 连接

**JetBrains DataGrip（收费，但功能最强大）**

1. 打开 DataGrip
2. Database → New → Data Source → H2
3. 配置：
   ```
   Host: localhost
   Port: 9092
   File: ./data/toolmanager
   User: sa
   Password: (留空)
   ```
4. 点击 Test Connection

#### 使用 Navicat 连接

**Navicat（收费）**

1. 新建连接 → H2
2. 设置：
   ```
   Host: localhost
   Port: 9092
   Database: file:./data/toolmanager
   User: sa
   Password: (留空)
   ```

**特点：**
- ✅ 支持 IDE 和数据库工具
- ✅ 远程连接，跨网络
- ✅ 功能齐全（SQL、导出、导入等）
- ✅ 生产环境推荐

**使用场景：**
- IDE 中管理数据库
- 远程访问数据库
- 数据库备份和迁移
- 性能分析和调优

---

### 方式 4：PostgreSQL 兼容模式（可选）🐘

**将 H2 作为 PostgreSQL 使用**

```
协议: PostgreSQL (H2 兼容)
主机: localhost
端口: 5435
数据库: toolmanager
JDBC URL: jdbc:postgresql://localhost:5435/toolmanager
用户名: sa
密码: (空)
```

**启用方式：**

在 `application.properties` 中添加：
```properties
h2.pg.enabled=true
```

**支持的工具：**
- 所有 PostgreSQL 客户端

**使用场景：**
- 需要使用 PostgreSQL 兼容工具
- 不常用

---

## 🚀 快速开始

### 步骤 1：启动应用

```powershell
cd backend
java -jar target/tool-manager-backend-1.0.0.jar
```

等待看到日志：
```
✓ H2 TCP 服务器已启动
监听地址: tcp://localhost:9092
```

### 步骤 2：选择连接方式

#### 选项 A：Web 控制台（最简单）
```
打开浏览器 → http://localhost:8080/h2-console
输入 JDBC URL → Connect
```

#### 选项 B：DBeaver（最专业）
1. 下载安装 DBeaver
2. 新建 H2 连接
3. Host: localhost, Port: 9092
4. Test Connection

### 步骤 3：验证连接

在 Web Console 或 DBeaver 中执行：
```sql
SELECT * FROM DB_CONNECTIONS;
```

应该能看到你之前保存的连接配置。

---

## ✅ 验证数据持久化

### 场景：添加连接后重启应用

1. **添加连接配置**
   - 打开应用前端
   - 添加一个新的数据库连接
   - 保存

2. **查看数据库**
   - 打开 H2 Web Console 或 DBeaver
   - 查询 `SELECT * FROM DB_CONNECTIONS;`
   - 应该能看到你新添加的连接 ✅

3. **重启应用**
   - 关闭应用
   - 重新启动
   - 等待 3-5 秒，让 H2 数据库打开

4. **再次验证**
   - 打开前端
   - 查看连接配置，应该仍然存在 ✅
   - 或者用 DBeaver 查询，应该仍然有数据 ✅

---

## 📊 常见问题

### Q1: TCP 连接失败 "无法连接到 localhost:9092"

**可能原因：**
1. 应用未启动
2. 应用启动失败
3. 防火墙阻止了 9092 端口

**解决方案：**
```powershell
# 检查应用是否运行
Get-Process java

# 检查 9092 端口是否监听
netstat -ano | findstr :9092

# 如果没看到监听，检查应用日志
# 应该看到: ✓ H2 TCP 服务器已启动
```

### Q2: Web Console 中看不到 DB_CONNECTIONS 表

**可能原因：**
1. JDBC URL 写错了（没有指定数据库文件路径）
2. 连接到了错误的数据库

**解决方案：**
```
确保 JDBC URL 是：
jdbc:h2:file:./data/toolmanager;MODE=MySQL

不是：
jdbc:h2:mem:test  (这是内存数据库)
或
jdbc:h2:./data/toolmanager  (缺少 file: 前缀)
```

### Q3: DBeaver 显示 "权限不足" 或无法写入数据

**原因：** H2 数据库文件所有者权限

**解决方案：**
```
通常不是权限问题。检查：
1. 数据库文件是否存在: ./data/toolmanager.mv.db
2. 应用是否仍在运行
3. DBeaver 连接是否自动断开
```

### Q4: 数据还是没有持久化

**排查步骤：**

1. **检查数据库文件是否存在**
   ```powershell
   Get-Item ./data/toolmanager.mv.db
   ```
   如果不存在，说明应用未正常创建数据库

2. **检查应用日志**
   ```
   看是否有错误日志
   应该看到: ✓ 数据库连接已保存: ID=x, Name=xxx
   ```

3. **检查 H2 配置**
   ```properties
   # 应该是
   spring.datasource.url=jdbc:h2:file:./data/toolmanager;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
   
   不是 DB_CLOSE_DELAY=1 (会立即关闭)
   ```

4. **直接用 DBeaver 查询**
   ```sql
   SELECT COUNT(*) FROM DB_CONNECTIONS;
   ```

---

## 🔐 网络和安全

### 远程访问

如果需要从另一台机器访问数据库：

```
替换 localhost 为 服务器 IP 地址

示例：
本地: tcp://localhost:9092
远程: tcp://192.168.1.100:9092
```

### 防火墙配置

**Windows 防火墙**
```powershell
# 允许 Java 应用通过防火墙
netsh advfirewall firewall add rule name="H2 Database" `
  dir=in action=allow program="C:\Program Files\Java\jdkXX\bin\java.exe"
```

**Linux 防火墙**
```bash
sudo ufw allow 9092/tcp
sudo ufw allow 8080/tcp
```

---

## 📝 配置说明

### application.properties 中的关键配置

```properties
# 数据库 URL - 确保包含以下参数
spring.datasource.url=jdbc:h2:file:./data/toolmanager;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE

参数说明：
- file:  →  使用文件模式（不是内存）
- MODE=MySQL  →  H2 兼容 MySQL 语法
- DB_CLOSE_DELAY=-1  →  延迟关闭数据库（-1 表示永不自动关闭）
- DB_CLOSE_ON_EXIT=FALSE  →  JVM 退出时不关闭数据库（允许重新连接）

# Web Console
spring.h2.console.enabled=true  →  启用 Web 控制台
spring.h2.console.path=/h2-console  →  访问路径

# TCP 服务器
h2.tcp.enabled=true  →  启用 TCP 服务器（默认启用）
```

### 禁用 TCP 服务器（如果需要）

在 `application.properties` 中添加：
```properties
h2.tcp.enabled=false
```

---

## 🎯 推荐的使用方案

### 开发环境
```
Web Console: 快速查看数据
DBeaver: 深入分析和调试
```

### 生产环境
```
DBeaver: 定期备份
TCP 连接: 远程管理
应用日志: 监控操作
```

---

## 📚 参考资源

- [H2 Database 官方文档](http://www.h2database.com/html/main.html)
- [DBeaver 官方网站](https://dbeaver.io/)
- [DataGrip 官方网站](https://www.jetbrains.com/datagrip/)
- [Spring Boot H2 配置](https://spring.io/guides/gs/accessing-data-h2/)

---

## ✨ 现在就开始

1. **启动应用**
   ```powershell
   java -jar target/tool-manager-backend-1.0.0.jar
   ```

2. **打开 Web Console**
   ```
   http://localhost:8080/h2-console
   ```

3. **或使用 DBeaver**
   ```
   新建连接 → H2 → localhost:9092
   ```

4. **验证数据**
   ```sql
   SELECT * FROM DB_CONNECTIONS;
   ```

---

**数据持久化问题已解决！** ✅
