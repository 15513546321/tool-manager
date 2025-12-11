# Tool Manager - 数据交互与测试指南

## 概述

本文档说明 Tool Manager 应用中前端和后端的数据交互流程、数据持久化方式，以及如何进行端到端（E2E）测试和验证。

## 架构图

```
┌─────────────────────────────────────┐
│         前端 (React + TS)           │
│  - 页面组件                         │
│  - 服务层 (auditService.ts)        │
└────────────┬────────────────────────┘
             │
             │ HTTP/REST API 调用
             │ (JSON 数据交换)
             │
┌────────────▼────────────────────────┐
│   后端 (Spring Boot 2.7.x)          │
│  - Controllers (REST API)            │
│  - Services (业务逻辑)              │
│  - Repositories (数据访问)          │
│  - Entities (数据模型)              │
└────────────┬────────────────────────┘
             │
             │ JDBC/JPA
             │
┌────────────▼────────────────────────┐
│   H2 Database (嵌入式)              │
│  - 文件: /data/tooldb.mv.db         │
│  - 表: audit_logs, ip_mappings      │
└─────────────────────────────────────┘
```

## 1. 数据交互流程

### 1.1 审计日志记录流程

#### 场景：用户在前端执行操作（如"保存菜单"）

1. **前端触发操作**
   ```typescript
   // 在 MenuManagement.tsx 中
   const handleSave = async () => {
       // 执行操作...
       
       // 记录审计日志
       recordAction('系统设置 - 菜单管理', '按钮:保存 - 修改菜单名称');
   };
   ```

2. **调用审计服务（auditService.ts）**
   ```typescript
   export const recordAction = async (action: string, details: string) => {
       try {
           await fetch('/api/audit/log', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               credentials: 'include',
               body: JSON.stringify({ action, details }),
           });
       } catch (err) {
           console.error('Failed to record action:', err);
       }
   };
   ```

3. **后端处理请求（AuditLogController.java）**
   ```java
   @PostMapping("/log")
   public ResponseEntity<AuditLogDto> recordLog(
           @RequestBody Map<String, String> payload,
           HttpServletRequest request) {
       String clientIp = getClientIp(request);  // 获取真实客户端IP
       String action = payload.getOrDefault("action", "Unknown");
       String details = payload.getOrDefault("details", "");
       
       AuditLogDto log = auditLogService.recordAction(clientIp, action, details);
       return ResponseEntity.ok(log);
   }
   ```

4. **服务层处理（AuditLogService.java）**
   ```java
   public AuditLogDto recordAction(String clientIp, String action, String details) {
       String username = ipMappingService.getNameByIp(clientIp);  // 查询IP映射
       
       AuditLog log = new AuditLog();
       log.setTimestamp(LocalDateTime.now().format(...));
       log.setIp(clientIp);
       log.setUsername(username);
       log.setAction(action);
       log.setDetails(details);
       
       AuditLog saved = auditLogRepository.save(log);  // 保存到数据库
       return convertToDto(saved);
   }
   ```

5. **数据持久化（H2 Database）**
   - 数据保存到 `audit_logs` 表
   - 表结构：
     ```sql
     CREATE TABLE audit_logs (
         id BIGINT PRIMARY KEY AUTO_INCREMENT,
         timestamp VARCHAR(255) NOT NULL,
         ip VARCHAR(45) NOT NULL,
         username VARCHAR(255),
         action VARCHAR(255) NOT NULL,
         details TEXT
     );
     ```

6. **响应返回前端**
   ```json
   {
       "id": 1,
       "timestamp": "2024-12-11 10:30:45",
       "ip": "192.168.1.100",
       "username": "张三",
       "action": "系统设置 - 菜单管理",
       "details": "按钮:保存 - 修改菜单名称"
   }
   ```

### 1.2 查询审计日志流程

#### 场景：用户打开"审计日志"页面

1. **前端加载组件时（AuditLog.tsx）**
   ```typescript
   useEffect(() => {
       const fetchData = async () => {
           const fetchedLogs = await getLogs();
           const fetchedMappings = await getIpMappings();
           setLogs(fetchedLogs);
           setMappings(fetchedMappings);
       };
       
       fetchData();
       
       // 每5秒刷新一次
       const interval = setInterval(fetchData, 5000);
       return () => clearInterval(interval);
   }, []);
   ```

2. **调用后端 API**
   ```typescript
   // 获取所有日志
   const resp = await fetch('/api/audit/logs', { credentials: 'include' });
   
   // 获取IP映射
   const resp = await fetch('/api/ip-mappings', { credentials: 'include' });
   ```

3. **后端查询（AuditLogController.java）**
   ```java
   @GetMapping("/logs")
   public ResponseEntity<List<AuditLogDto>> getLogs() {
       List<AuditLogDto> logs = auditLogService.getAllLogs();
       return ResponseEntity.ok(logs);
   }
   ```

4. **服务层查询（AuditLogService.java）**
   ```java
   public List<AuditLogDto> getAllLogs() {
       return auditLogRepository.findAll()
               .stream()
               .map(this::convertToDto)
               .sorted((a, b) -> Long.compare(b.getId(), a.getId()))
               .collect(Collectors.toList());
   }
   ```

5. **前端显示（动态名称解析）**
   ```typescript
   const displayLogs = useMemo(() => {
       return logs.map(log => {
           // 使用最新的 IP 映射配置动态解析名称
           const mapping = mappings.find(m => m.ip === log.ip);
           return {
               ...log,
               displayName: mapping ? mapping.name : (log.username || 'Unknown User')
           };
       });
   }, [logs, mappings]);
   ```

### 1.3 IP 映射管理流程

#### 场景：管理员在"IP 映射配置"页面添加新映射

1. **前端表单提交（IpConfig.tsx）**
   ```typescript
   const handleAddMapping = async () => {
       if (newIp && newName) {
           await saveIpMappings([{ ip: newIp, name: newName }]);
           const updated = [...mappings, { ip: newIp, name: newName }];
           setMappings(updated);
       }
   };
   ```

2. **调用后端 API**
   ```typescript
   // 保存单个或多个映射
   await fetch('/api/ip-mappings', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include',
       body: JSON.stringify({ ip: '192.168.1.100', name: '张三' }),
   });
   ```

3. **后端处理（IpMappingController.java）**
   ```java
   @PostMapping
   public ResponseEntity<IpMappingDto> createMapping(@RequestBody Map<String, String> payload) {
       String ip = payload.get("ip");
       String name = payload.get("name");
       
       IpMappingDto mapping = ipMappingService.createMapping(ip, name);
       return ResponseEntity.ok(mapping);
   }
   ```

4. **数据持久化（H2 Database）**
   - 数据保存到 `ip_mappings` 表
   - 表结构：
     ```sql
     CREATE TABLE ip_mappings (
         id BIGINT PRIMARY KEY AUTO_INCREMENT,
         ip VARCHAR(45) NOT NULL UNIQUE,
         name VARCHAR(255) NOT NULL
     );
     ```

5. **后续影响**
   - 已有的审计日志中的 `username` 不变（记录创建时的映射）
   - 但在审计日志页面，会使用最新的 IP 映射配置动态显示用户名

## 2. 客户端 IP 获取逻辑

### 2.1 IPv4 地址验证

后端优先级顺序：

1. **X-Forwarded-For 头**（代理/负载均衡器）
   ```
   X-Forwarded-For: 192.168.1.100, 10.0.0.1
   → 返回: 192.168.1.100（第一个有效的 IPv4）
   ```

2. **X-Real-IP 头**（某些反向代理）
   ```
   X-Real-IP: 192.168.1.100
   → 返回: 192.168.1.100
   ```

3. **HttpServletRequest.getRemoteAddr()**（直连）
   ```
   remoteAddr: 192.168.1.100
   → 返回: 192.168.1.100
   ```

### 2.2 IP 过滤规则

```java
private boolean isValidIPv4(String ip) {
    if (ip == null || ip.isEmpty()) return false;
    
    // 拒绝 IPv6 地址（包含冒号）
    if (ip.contains(":")) return false;
    
    // 拒绝 IPv4 回环地址
    if (ip.startsWith("127.")) return false;
    
    // 验证 IPv4 格式（4 个 0-255 的数字）
    String[] parts = ip.split("\\.");
    if (parts.length != 4) return false;
    for (String part : parts) {
        try {
            int num = Integer.parseInt(part);
            if (num < 0 || num > 255) return false;
        } catch (NumberFormatException e) {
            return false;
        }
    }
    return true;
}
```

### 2.3 示例

```
输入                          | 输出
------------------------------|------------------
192.168.1.100                | 192.168.1.100 ✓
127.0.0.1                    | 127.0.0.1 (filtered)
::1                          | ::1 (IPv6, filtered)
[::1]:8080                   | [::1]:8080 (filtered)
300.168.1.100                | Invalid (filtered)
192.168.1                    | Invalid (filtered)
```

## 3. 数据库持久化验证

### 3.1 H2 数据库文件位置

```
/opt/tool-manager/data/tooldb.mv.db     (Linux)
G:\vsCodeWorkSpace\tool-manager\backend\data\tooldb.mv.db  (Windows)
```

### 3.2 数据库初始化

- **自动创建**：首次启动时，Spring Boot 自动创建数据库和表
- **JPA 配置**：`spring.jpa.hibernate.ddl-auto=update` 自动更新 schema

### 3.3 验证数据持久化

**方式 1：通过 H2 Web 控制台**
```
1. 访问 http://localhost:8080/h2-console
2. 连接字符串: jdbc:h2:file:./data/tooldb
3. 用户名: sa
4. 密码: (留空)
5. 点击 Connect
6. 查看表数据
```

**方式 2：通过 SQL 查询 API**
```bash
# 查看所有审计日志
curl http://localhost:8080/api/audit/logs

# 查看所有 IP 映射
curl http://localhost:8080/api/ip-mappings
```

**方式 3：检查文件系统**
```bash
ls -lh /opt/tool-manager/data/tooldb.mv.db
file /opt/tool-manager/data/tooldb.mv.db
```

## 4. 端到端（E2E）测试指南

### 4.1 测试环境准备

```bash
# 1. 启动后端
cd /opt/tool-manager/backend
mvn clean spring-boot:run
# 或
java -jar target/tool-manager-backend-1.0.0.jar

# 2. 验证后端运行
curl http://localhost:8080/api/client-ip
# 响应: {"ip":"192.168.1.100"}
```

### 4.2 测试场景 1：记录和查询审计日志

```bash
# 1. 清空现有日志（可选）
curl -X POST http://localhost:8080/api/audit/logs -H "Content-Type: application/json" \
  -d '{"action":"Test Action","details":"Test Details"}'

# 2. 查询日志
curl http://localhost:8080/api/audit/logs | jq .

# 3. 验证数据库（使用 H2 控制台或 SQL）
SELECT * FROM audit_logs ORDER BY id DESC;
```

**预期结果**：
```json
[
  {
    "id": 1,
    "timestamp": "2024-12-11 10:30:45",
    "ip": "127.0.0.1",
    "username": null,
    "action": "Test Action",
    "details": "Test Details"
  }
]
```

### 4.3 测试场景 2：IP 映射与动态名称解析

```bash
# 1. 添加 IP 映射
curl -X POST http://localhost:8080/api/ip-mappings \
  -H "Content-Type: application/json" \
  -d '{"ip":"192.168.1.100","name":"张三"}'

# 2. 创建审计日志（模拟来自 192.168.1.100 的请求）
# 注：需要实际从该 IP 发起请求，或通过 X-Forwarded-For 头模拟
curl -X POST http://localhost:8080/api/audit/log \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 192.168.1.100" \
  -d '{"action":"Test","details":"From 192.168.1.100"}'

# 3. 查询日志
curl http://localhost:8080/api/audit/logs | jq '.[] | {ip, username, action}'

# 4. 删除映射
curl -X DELETE http://localhost:8080/api/ip-mappings/192.168.1.100

# 5. 再次查询日志（名称映射应更新）
curl http://localhost:8080/api/audit/logs | jq '.[] | {ip, username, action}'
```

**预期结果**：
```json
[
  {
    "ip": "192.168.1.100",
    "username": "张三",
    "action": "Test"
  }
]
```

### 4.4 测试场景 3：通过浏览器 UI 测试（完整流程）

1. **打开应用**
   ```
   访问 http://localhost:8080/ 或 http://127.0.0.1:8080/
   ```

2. **导航到 "系统设置" → "IP 映射配置"**
   - 点击 "添加映射" 按钮
   - 输入 IP 地址: `192.168.1.100`
   - 输入姓名: `张三`
   - 点击 "添加映射" 确认

3. **执行任何操作以记录审计日志**
   - 修改菜单、生成代码等任何操作都会自动调用 `recordAction()`

4. **查看审计日志**
   - 点击左侧菜单 "审计日志 & 安全"
   - 应该看到刚才执行的操作记录
   - 验证 IP 和用户名是否正确显示

5. **验证数据库**
   ```
   访问 http://localhost:8080/h2-console
   查看 audit_logs 和 ip_mappings 表中的数据
   ```

## 5. API 文档

### 5.1 审计日志 API

| 方法 | 端点 | 描述 | 请求体 | 响应 |
|-----|------|------|--------|------|
| POST | `/api/audit/log` | 记录操作 | `{"action":"","details":""}` | `AuditLogDto` |
| GET | `/api/audit/logs` | 获取所有日志 | - | `AuditLogDto[]` |
| GET | `/api/audit/logs/latest?limit=100` | 获取最新日志 | - | `AuditLogDto[]` |

### 5.2 IP 映射 API

| 方法 | 端点 | 描述 | 请求体 | 响应 |
|-----|------|------|--------|------|
| GET | `/api/ip-mappings` | 获取所有映射 | - | `IpMappingDto[]` |
| POST | `/api/ip-mappings` | 创建映射 | `{"ip":"","name":""}` | `IpMappingDto` |
| PUT | `/api/ip-mappings/{ip}` | 更新映射 | `{"name":""}` | `IpMappingDto` |
| DELETE | `/api/ip-mappings/{ip}` | 删除映射 | - | 204 No Content |
| GET | `/api/ip-mappings/lookup/{ip}` | 查询 IP 映射 | - | `{"ip":"","name":""}` |

### 5.3 客户端 IP API

| 方法 | 端点 | 描述 | 请求体 | 响应 |
|-----|------|------|--------|------|
| GET | `/api/client-ip` | 获取客户端 IP | - | `{"ip":"192.168.1.100"}` |

## 6. 故障排查

### 问题 1：审计日志不显示

**症状**：执行操作后，审计日志页面没有新记录

**排查步骤**：
1. 检查浏览器控制台是否有错误（F12）
2. 检查后端日志：`tail -f /var/log/tool-manager.log`
3. 验证数据库连接：`curl http://localhost:8080/api/audit/logs`
4. 检查防火墙是否阻止了 8080 端口

**解决方案**：
- 确保后端正常运行
- 清除浏览器缓存（Ctrl+Shift+Delete）
- 重启后端服务

### 问题 2：IP 地址显示不正确

**症状**：所有请求的 IP 都显示为 127.0.0.1 或 ::1

**原因**：可能在代理环境中，未正确设置 `X-Forwarded-For` 或 `X-Real-IP` 头

**解决方案**：
1. 检查代理配置（Nginx、Apache 等）
   ```nginx
   # Nginx 配置示例
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Real-IP $remote_addr;
   ```

2. 在 AuditLogController 中添加日志：
   ```java
   System.out.println("X-Forwarded-For: " + request.getHeader("X-Forwarded-For"));
   System.out.println("X-Real-IP: " + request.getHeader("X-Real-IP"));
   System.out.println("remoteAddr: " + request.getRemoteAddr());
   ```

### 问题 3：H2 数据库文件过大或损坏

**症状**：应用启动缓慢或无法启动

**解决方案**：
```bash
# 1. 停止应用
sudo systemctl stop tool-manager

# 2. 删除数据库文件
rm /opt/tool-manager/data/tooldb.mv.db

# 3. 重启应用（会自动创建新数据库）
sudo systemctl start tool-manager
```

## 7. 性能优化建议

1. **定期清理日志**
   ```sql
   DELETE FROM audit_logs WHERE DATE(timestamp) < DATE_SUB(NOW(), INTERVAL 30 DAY);
   ```

2. **添加数据库索引**
   ```sql
   CREATE INDEX idx_ip ON audit_logs(ip);
   CREATE INDEX idx_timestamp ON audit_logs(timestamp);
   ```

3. **升级到 PostgreSQL（大数据量）**
   - H2 适合小型应用，大数据量建议迁移到 PostgreSQL

4. **启用数据库连接池**
   ```properties
   spring.datasource.hikari.maximum-pool-size=10
   spring.datasource.hikari.minimum-idle=5
   ```

---

**最后更新**：2024-12-11
**版本**：1.0
