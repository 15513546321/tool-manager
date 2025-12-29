# Oracle DDL 同步 - 连接健壮性改进

## 📋 改进概述

本次更新针对 **Oracle DDL 同步** 模块的数据库连接功能进行了全面增强，解决了连接不稳定、SID方式连接失败等问题。

---

## 🔧 主要改进

### 1. **连接超时配置**
添加了完善的超时机制，避免连接长时间挂起：

```java
// 设置驱动级别的登录超时 (10秒)
DriverManager.setLoginTimeout(10);

// 在连接字符串中添加 Oracle 特定的超时参数
oracle.net.CONNECT_TIMEOUT=10000  // 连接超时 10秒
oracle.jdbc.ReadTimeout=15000      // 读取超时 15秒
oracle.net.READ_TIMEOUT=15000      // 网络读取超时 15秒
```

### 2. **连接有效性测试**
不仅建立连接，还执行实际查询验证连接可用性：

```java
// 执行简单查询测试连接
Statement stmt = conn.createStatement();
stmt.setQueryTimeout(5); // 查询超时5秒
ResultSet rs = stmt.executeQuery("SELECT 1 FROM DUAL");
```

### 3. **增强的错误诊断**
针对常见 Oracle 错误提供详细的中文诊断信息：

| 错误代码 | 原因 | 解决方案 |
|---------|------|---------|
| ORA-01017 | 用户名或密码错误 | 检查认证信息 |
| ORA-12505 | 无法解析 SID/Service Name | 检查连接字符串格式 |
| ORA-12514 | TNS 监听程序无法识别服务 | 确认 Service Name 正确 |
| ORA-12541 / ORA-12170 | 无法连接到数据库 | 检查主机、端口、防火墙 |
| SQLTimeoutException | 连接或查询超时 | 检查网络或数据库负载 |

### 4. **SID vs Service Name 明确说明**
在前端 UI 添加了清晰的格式说明，突出两种方式的区别：

```
✅ SID 方式 (推荐用于传统实例)
jdbc:oracle:thin:@10.20.72.168:1521:ECSS
                                    ↑ 冒号

✅ Service Name 方式 (推荐用于 RAC / PDB)
jdbc:oracle:thin:@10.20.72.168:1521/ECSS
                                    ↑ 斜杠
```

⚠️ **重要提示：** 请注意区分冒号(`:`)和斜杠(`/`)符号！如果连接失败，请尝试切换SID和Service方式。

---

## 🛡️ 安全性改进

### 连接字符串脱敏
在日志中自动隐藏密码等敏感信息：

```java
private String sanitizeUrl(String url) {
    return url.replaceAll("(password|passwd|pwd)=[^&]+", "$1=***");
}
```

示例：
```
🔗 Testing connection: jdbc:oracle:thin:@192.168.1.100:1521/PROD?password=***
```

---

## 📊 连接测试性能监控

现在会显示连接测试的响应时间：

```json
{
  "success": true,
  "data": {
    "message": "✓ 数据库连接成功 (oracle.jdbc.OracleDriver)",
    "elapsed": "234ms",
    "tip": "连接测试通过，响应时间 234ms"
  }
}
```

---

## 🔍 故障排查指南

### 问题 1: SID 方式连接失败
**症状**: 错误 ORA-12505 - 无法解析 SID

**解决方案**:
1. 确认连接字符串使用 **冒号** (`:`)
   ```
   jdbc:oracle:thin:@host:port:SID
   ```
2. 检查 SID 名称是否正确（区分大小写）
3. 确认数据库实例已启动

**备选方案**: 尝试使用 Service Name 方式（改用斜杠 `/`）

---

### 问题 2: Service Name 方式连接失败
**症状**: 错误 ORA-12514 - TNS 监听程序无法识别服务

**解决方案**:
1. 确认连接字符串使用 **斜杠** (`/`)
   ```
   jdbc:oracle:thin:@host:port/SERVICE_NAME
   ```
2. 检查 Service Name 是否正确
3. 在数据库端执行以下 SQL 查看可用的 Service Name：
   ```sql
   SELECT name FROM v$services;
   ```

**备选方案**: 尝试使用 SID 方式（改用冒号 `:`）

---

### 问题 3: 连接超时
**症状**: SQLTimeoutException - 连接超时

**可能原因**:
- 网络延迟过高
- 防火墙阻止连接
- 数据库服务器负载过高
- 主机地址或端口错误

**排查步骤**:
1. Ping 数据库服务器：
   ```bash
   ping 192.168.1.100
   ```
2. 测试端口连通性：
   ```bash
   telnet 192.168.1.100 1521
   ```
3. 检查防火墙规则
4. 联系数据库管理员确认服务状态

---

## 📝 连接字符串示例

### 常见格式

| 场景 | 连接字符串 |
|-----|----------|
| **开发环境 (SID)** | `jdbc:oracle:thin:@localhost:1521:XE` |
| **生产环境 (Service)** | `jdbc:oracle:thin:@prod-db.company.com:1521/PROD_SERVICE` |
| **RAC 集群** | `jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=node1)(PORT=1521))(ADDRESS=(PROTOCOL=TCP)(HOST=node2)(PORT=1521)))(CONNECT_DATA=(SERVICE_NAME=RAC_SERVICE)))` |
| **带超时参数** | `jdbc:oracle:thin:@host:port/service?oracle.net.CONNECT_TIMEOUT=5000` |

---

## 🚀 性能优化建议

1. **使用连接池**: 在生产环境中配置 HikariCP 等连接池
2. **网络优化**: 确保数据库服务器与应用服务器之间的网络延迟 < 50ms
3. **索引优化**: 对比大表时确保有适当的索引
4. **定期维护**: 定期更新统计信息和重建索引

---

## ✅ 测试验证

### 测试场景
- ✅ SID 方式连接 Oracle 11g/12c/19c
- ✅ Service Name 方式连接 Oracle 19c RAC
- ✅ 连接超时自动断开（10秒）
- ✅ 错误信息正确分类和提示
- ✅ 连接日志脱敏处理
- ✅ 连接性能监控（响应时间）

### 兼容性
- Oracle 11g+
- Oracle 12c+
- Oracle 19c
- Oracle 21c

---

## 📚 相关文档

- [Oracle JDBC 官方文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/jjdbc/)
- [Oracle Net Services 配置指南](https://docs.oracle.com/en/database/oracle/oracle-database/19/netag/)
- [常见 TNS 错误排查](https://docs.oracle.com/en/database/oracle/oracle-database/19/errmg/)

---

## 🔄 更新历史

**Version 1.1.0** - 2025-12-29
- ✨ 添加连接超时配置
- ✨ 增强错误诊断和中文提示
- ✨ 优化 UI 说明，明确 SID/Service 区别
- ✨ 添加连接性能监控
- 🛡️ 添加连接字符串脱敏
- 🐛 修复 SID 方式连接失败问题

---

## 💡 技术支持

如有问题，请提供以下信息：
1. 完整的错误信息和错误代码
2. 使用的连接字符串格式（脱敏后）
3. Oracle 版本信息
4. 网络拓扑（是否跨网段、防火墙配置等）

---

## 📄 许可证

本项目遵循内部使用许可。
