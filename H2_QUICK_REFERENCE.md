## 🚀 H2 数据库快速参考

### 📡 4 种连接方式一览

```
1️⃣  嵌入式 (应用内) - jdbc:h2:file:./data/toolmanager;MODE=MySQL
    ├─ 最快速
    ├─ 无需额外配置
    └─ 仅应用内使用

2️⃣  Web Console (浏览器) - http://localhost:8080/h2-console
    ├─ 可视化界面
    ├─ SQL 编辑器
    └─ 数据导出功能

3️⃣  TCP 远程 (IDE 工具) - tcp://localhost:9092 ⭐ 推荐
    ├─ DBeaver/DataGrip/Navicat
    ├─ JDBC: jdbc:h2:tcp://localhost:9092/file:./data/toolmanager;MODE=MySQL
    ├─ 用户: sa
    └─ 密码: (空)

4️⃣  PostgreSQL 兼容 (可选) - localhost:5435
    ├─ 支持 PostgreSQL 工具
    └─ 需启用: h2.pg.enabled=true
```

---

### ✅ 修复内容一览

```
问题 1: 数据不持久化
✓ 修复：DbConnectionService 添加 flush() 调用
✓ 修复：H2 连接参数添加 DB_CLOSE_ON_EXIT=FALSE

问题 2: 无法远程访问
✓ 修复：启动 H2 TCP 服务器
✓ 修复：支持 DBeaver 等工具连接

问题 3: 数据库名称不统一
✓ 修复：Linux 配置改为 toolmanager
```

---

### 🔧 快速配置

**启用 TCP 服务器（默认启用）**
```properties
# application.properties
h2.tcp.enabled=true
```

**禁用 TCP 服务器**
```properties
h2.tcp.enabled=false
```

**启用 PostgreSQL 兼容**
```properties
h2.pg.enabled=true
```

---

### 🧪 快速验证

```powershell
# 1. 启动应用
java -jar target/tool-manager-backend-1.0.0.jar

# 2. 打开 Web Console
浏览器访问 http://localhost:8080/h2-console

# 3. 输入连接信息
JDBC URL: jdbc:h2:file:./data/toolmanager;MODE=MySQL
用户: sa
密码: (空)

# 4. 查询表
SELECT * FROM DB_CONNECTIONS;
```

---

### 📋 DBeaver 连接配置（一分钟上手）

```
1. 打开 DBeaver → Database → New Connection
2. 选择 H2
3. 配置：
   ├─ Host: localhost
   ├─ Port: 9092
   ├─ Database: file:./data/toolmanager
   ├─ User: sa
   └─ Password: (空)
4. Test Connection → 成功 ✓
```

---

### 📊 文件位置参考

```
Windows:
  ./data/toolmanager.mv.db
  
Linux:
  /var/data/tool-manager/toolmanager.mv.db
  
配置文件：
  backend/src/main/resources/application.properties
  backend/src/main/resources/application-linux.properties
```

---

### 🔍 故障排除 3 步

```
1. 检查数据库文件是否存在
   ✓ Windows: ./data/toolmanager.mv.db
   ✓ Linux: /var/data/tool-manager/toolmanager.mv.db

2. 检查应用日志
   ✓ 应该看到: ✓ H2 TCP 服务器已启动: tcp://localhost:9092

3. 用 Web Console 测试连接
   ✓ http://localhost:8080/h2-console
   ✓ SELECT * FROM DB_CONNECTIONS;
```

---

### 💡 关键参数说明

| 参数 | 含义 | 重要性 |
|------|------|--------|
| `file:` | 文件模式（不是内存） | ⭐⭐⭐ 必须 |
| `MODE=MySQL` | MySQL 兼容模式 | ⭐⭐⭐ 必须 |
| `DB_CLOSE_DELAY=-1` | 延迟关闭连接 | ⭐⭐ 重要 |
| `DB_CLOSE_ON_EXIT=FALSE` | 不在 JVM 退出时关闭 | ⭐⭐⭐ 重要 |
| `-tcpAllowOthers` | 允许远程连接 | ⭐⭐ 重要 |

---

### 📞 常见问题速查

| 问题 | 解决方案 |
|------|--------|
| 数据重启后消失 | ✓ flush() 已添加 |
| TCP 连接失败 | ✓ 检查 9092 端口 |
| 看不到表 | ✓ 检查 JDBC URL 的 file: 前缀 |
| Web Console 打不开 | ✓ 检查 http://localhost:8080/h2-console |
| 防火墙问题 | ✓ 允许 9092、8080 端口 |

---

**完整文档：** `H2_REMOTE_CONNECTION_GUIDE.md` 和 `H2_PERSISTENCE_FIX_SUMMARY.md`
