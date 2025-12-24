# Bug Fixes Summary - 2025-12-24

## 完成的全部修复

### 问题1：Oracle DDL 连接配置添加报错 ✅
**症状：**
```
org.h2.jdbc.JdbcSQLIntegrityConstraintViolationException: NULL not allowed for column "DB_TYPE"
```

**根本原因：**
数据库schema中表字段名为 `db_type`，但JPA Entity中定义的字段名为 `type`，缺少 `@Column(name="db_type")` 的映射注解。

**修复方案：**
在 `DbConnection.java` 中为 `type` 字段添加列名映射：
```java
@Column(name = "db_type", nullable = false)
private String type; // ORACLE_SOURCE, ORACLE_TARGET, etc.
```

**文件修改：**
- `backend/src/main/java/com/toolmanager/entity/DbConnection.java`

---

### 问题2：IP 映射配置 - 删除失败和批量导入不显示 ✅
**症状：**
1. 删除单条记录失败，刷新页面所有配置都没有了
2. 批量导入显示成功，但不展示数据

**根本原因：**
1. **删除Race Condition**：前端代码先本地删除UI中的映射，然后再调用后端删除。如果后端删除失败，但UI已更新，刷新后数据会消失。
2. **批量导入错误处理不足**：使用 `saveIpMappings()` 函数假设所有请求都会成功，但当某些IP已存在或网络失败时，不会给予用户反馈，UI也不会更新。

**修复方案：**

#### 修复1：删除操作原子性 (IpConfig.tsx)
改变删除流程：**先删除后端 → 再更新前端UI**
```tsx
// OLD: 先删除UI，后删除后端（容易失同步）
const updated = mappings.filter(m => m.ip !== ip);
setMappings(updated);
await delete();

// NEW: 先删除后端，确认成功后再删除UI
const resp = await fetch(`/api/ip-mappings/${id}`, { method: 'DELETE' });
if (!resp.ok) {
  alert('删除失败');
  return;
}
const updated = mappings.filter(m => m.ip !== ip);
setMappings(updated);
```

#### 修复2：批量导入 (IpConfig.tsx)
改进错误处理，逐个保存并统计结果：
- 逐个POST每条映射，捕获单个失败
- 统计成功/失败数量
- **导入完成后重新加载数据库数据**，确保UI同步
- 向用户显示详细的失败信息

**文件修改：**
- `pages/admin/IpConfig.tsx`
  - 修改 `handleDeleteMapping()` 方法
  - 修改 `handleImportFile()` 方法

---

### 问题3：Nacos 配置同步 - 配置列表为空 ✅
**症状：**
配置连接显示成功，但配置列表清单中看不到配置的信息（永远显示"暂无配置"）

**根本原因：**
**数据库schema与JPA Entity完全不匹配！**

- **数据库 schema.sql** 中定义的 `nacos_configs` 表：
  ```sql
  CREATE TABLE nacos_configs (
      id, namespace, group_name, data_id, config_value, data_type, description...
  )
  ```

- **JPA Entity NacosConfig** 中定义的字段：
  ```java
  name, sourceUrl, sourceNamespace, sourceUsername, sourcePassword, sourceRemark,
  targetUrl, targetNamespace, targetUsername, targetPassword, targetRemark...
  ```

后端保存配置时，数据插入到不存在的列中，导致数据无法正确保存，查询时返回空列表。

**修复方案：**
更新 `schema.sql` 中的 `nacos_configs` 表定义，使其与Entity匹配：

```sql
CREATE TABLE IF NOT EXISTS nacos_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    source_url VARCHAR(500) NOT NULL,
    source_namespace VARCHAR(255),
    source_username VARCHAR(255),
    source_password VARCHAR(500),
    source_remark TEXT,
    target_url VARCHAR(500) NOT NULL,
    target_namespace VARCHAR(255),
    target_username VARCHAR(255),
    target_password VARCHAR(500),
    target_remark TEXT,
    sync_rules LONGTEXT,
    description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

同时，修复前端 `NacosSync.tsx` 中的API响应处理：
```tsx
// 后端返回格式：{ success: true, data: [...] }
const response = await apiService.nacosApi.queryConfigs();
if (response && response.success && Array.isArray(response.data)) {
  setConfigs(response.data);
}
```

**文件修改：**
- `backend/src/main/resources/schema.sql`
- `pages/sync/NacosSync.tsx`

---

### 问题4：Gitee 代码管理 - 公钥私钥输入框仍存在 ✅
**症状：**
之前删除的DocManagement.tsx和GiteeManagement.tsx中的Public Key和Private Key输入框已删除，但GiteeManagement.tsx中的验证逻辑、状态变量、初始化逻辑中仍然残留关于这两个字段的代码。

**根本原因：**
删除UI输入框后，没有完全清理相关的：
1. 状态对象中的 `privateKey` 和 `publicKey` 字段
2. 验证逻辑中的SSH私钥检查
3. 初始化和状态更新中的字段赋值
4. 发送到后端的payload中的这些字段

**修复方案：**
在 `GiteeManagement.tsx` 中：
1. 从状态对象 `config` 中删除 `privateKey` 和 `publicKey` 字段
2. 删除验证逻辑中的SSH私钥校验
3. 从所有配置初始化函数中删除这两个字段的赋值
4. 从所有后端API调用的payload中删除这两个字段

**修改位置：**
- 第68-73行：删除状态声明中的字段
- 第285-330行：删除 `handleAuthTypeChange()` 中的初始化
- 第361-371行：删除验证逻辑
- 第407-418行：删除配置保存中的字段
- 第428-441行：删除验证API调用中的字段
- 第510-520行：删除 `fetchBranches()` 中的payload字段
- 第670-675行：删除 `fetchChangesets()` 中的payload字段
- 第790-800行：删除 `fetchCommits()` 中的payload字段

**文件修改：**
- `pages/GiteeManagement.tsx`

---

## 编译验证结果

✅ **后端编译：** `BUILD SUCCESS` (mvn clean compile -DskipTests)  
✅ **前端编译：** `vite build success`

所有修改都已验证通过，无编译错误。

---

## 建议的后续操作

1. **数据迁移**（如果H2数据库已有数据）：
   - 删除现有H2数据库文件，重新初始化
   - 或编写migration脚本迁移旧数据

2. **测试清单**：
   - [ ] 删除IP映射 - 确认数据库同步
   - [ ] 批量导入IP映射 - 验证错误处理和显示
   - [ ] 创建Nacos配置 - 确认能保存和查询
   - [ ] Gitee SSH连接 - 确认不再要求输入公钥私钥
   - [ ] 刷新页面 - 验证数据持久化

3. **可选改进**：
   - 添加删除操作的Toast通知而非alert
   - 为批量导入添加进度条
   - 优化错误信息的展示格式
   - 添加单元测试覆盖关键业务逻辑


