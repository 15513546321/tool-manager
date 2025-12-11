# IPv4 客户端地址获取 - 诊断与修复指南

## 问题描述

审计日志中所有记录的 IP 都显示为 `127.0.0.1`（回环地址），而期望获得访问用户的真实本地 IPv4 地址。

## 根本原因

当通过 `http://localhost:8080/` 或 `http://127.0.0.1:8080/` 访问应用时，后端接收到的 `remoteAddr` 就是 `127.0.0.1`。这是技术上正确的，因为请求确实来自本地。

## 解决方案

### 方案 1：从其他设备访问（推荐用于局域网场景）

1. **获取服务器的局域网 IP 地址**

   **Windows 查看 IP：**
   ```powershell
   ipconfig
   # 查找 "IPv4 Address"，通常为 192.168.x.x 或 10.x.x.x
   ```

   **Linux 查看 IP：**
   ```bash
   ip addr show | grep "inet "
   # 或
   hostname -I
   ```

2. **从其他设备访问应用**
   ```
   例如，服务器 IP 为 192.168.1.100：
   在浏览器中访问：http://192.168.1.100:8080/
   而不是 http://localhost:8080/ 或 http://127.0.0.1:8080/
   ```

3. **验证 IP 识别**
   ```bash
   # 访问诊断端点
   curl http://192.168.1.100:8080/api/client-ip/debug
   
   # 输出示例：
   {
     "remoteAddr": "192.168.1.50",      # 客户端真实 IP
     "remoteHost": "192.168.1.50",
     "X-Forwarded-For": null,
     "X-Real-IP": null,
     "X-Client-IP": null,
     "CF-Connecting-IP": null,
     "detected-ip": "192.168.1.50",     # ✓ 正确识别的 IP
     "note": "..."
   }
   ```

### 方案 2：通过代理/负载均衡器转发头

如果应用后面有 Nginx、Apache 或其他反向代理，确保代理配置了正确的头部。

**Nginx 配置示例：**
```nginx
location / {
    proxy_pass http://localhost:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**验证代理转发：**
```bash
curl -H "X-Forwarded-For: 192.168.1.50" http://localhost:8080/api/client-ip/debug
# 应该返回 detected-ip: "192.168.1.50"
```

### 方案 3：Cloudflare 或其他 CDN

如果使用 Cloudflare，后端会自动从 `CF-Connecting-IP` 头获取真实 IP。

**验证：**
```bash
curl http://your-domain.com/api/client-ip/debug
# 应该能看到 CF-Connecting-IP 和 detected-ip 已正确设置
```

## 改进的 IP 检测逻辑

### 优先级顺序

后端现在按以下优先级查找客户端 IP：

1. **X-Forwarded-For** 头（代理/负载均衡器，通常包含多个 IP，取第一个有效的）
2. **X-Real-IP** 头（Nginx 反向代理）
3. **X-Client-IP** 头（某些代理）
4. **CF-Connecting-IP** 头（Cloudflare）
5. **remoteAddr** （直连，不通过代理）

### IPv4 验证规则

现在的代码**允许** `127.x.x.x` 地址，因为这反映了真实的直连情况。只拒绝：
- IPv6 地址（包含冒号 `:`）
- 非 IPv4 格式的字符串

## 诊断工具

### 1. 调试端点（新增）

```bash
GET /api/client-ip/debug
```

返回所有 IP 源信息，帮助诊断问题。

**示例 1：直连（本地访问）**
```bash
curl http://127.0.0.1:8080/api/client-ip/debug
```
**输出：**
```json
{
  "remoteAddr": "127.0.0.1",
  "remoteHost": "127.0.0.1",
  "X-Forwarded-For": null,
  "X-Real-IP": null,
  "X-Client-IP": null,
  "CF-Connecting-IP": null,
  "detected-ip": "127.0.0.1",
  "note": "如果 detected-ip 是 127.0.0.1，请确保通过局域网 IP 访问（如 192.168.1.x）而非 localhost"
}
```

**示例 2：通过局域网 IP 访问**
```bash
curl http://192.168.1.100:8080/api/client-ip/debug
```
**输出：**
```json
{
  "remoteAddr": "192.168.1.50",
  "remoteHost": "192.168.1.50",
  "X-Forwarded-For": null,
  "X-Real-IP": null,
  "X-Client-IP": null,
  "CF-Connecting-IP": null,
  "detected-ip": "192.168.1.50",
  "note": "..."
}
```

**示例 3：通过 Nginx 代理（模拟）**
```bash
curl -H "X-Forwarded-For: 203.0.113.50" http://localhost:8080/api/client-ip/debug
```
**输出：**
```json
{
  "remoteAddr": "127.0.0.1",
  "remoteHost": "127.0.0.1",
  "X-Forwarded-For": "203.0.113.50",
  "X-Real-IP": null,
  "X-Client-IP": null,
  "CF-Connecting-IP": null,
  "detected-ip": "203.0.113.50",
  "note": "..."
}
```

### 2. 简单端点

```bash
GET /api/client-ip
```

只返回检测到的 IP，适合前端使用。

## 测试步骤

### 步骤 1：重新构建后端

```bash
cd G:\vsCodeWorkSpace\tool-manager\backend

# Windows PowerShell 中，需要确保 Maven 在 PATH
mvn clean package -DskipTests

# 或直接运行
mvn spring-boot:run
```

### 步骤 2：确认本机局域网 IP

**Windows：**
```powershell
ipconfig

# 查找以下内容：
# Ethernet adapter Local Area Connection:
#    IPv4 Address . . . . . . . . . . . : 192.168.1.100
```

**Linux：**
```bash
ip addr show | grep "inet "
# 或
hostname -I
```

**Mac：**
```bash
ifconfig | grep "inet "
```

### 步骤 3：通过局域网 IP 访问

使用上面得到的 IP 地址（不是 localhost）：

```bash
# 例如，IP 为 192.168.1.100
http://192.168.1.100:8080/
```

### 步骤 4：验证 IP 获取

```bash
# 方式 1：通过诊断端点
curl http://192.168.1.100:8080/api/client-ip/debug

# 方式 2：简单端点
curl http://192.168.1.100:8080/api/client-ip
# 应返回: {"ip":"192.168.1.xx"}

# 方式 3：在前端执行操作并查看审计日志
# 进入"审计日志"页面，应看到真实的 IPv4 地址而非 127.0.0.1
```

## 常见情况汇总

| 访问方式 | 期望返回 IP | 说明 |
|--------|-----------|------|
| `http://localhost:8080/` | `127.0.0.1` | ✓ 正确（本地回环） |
| `http://127.0.0.1:8080/` | `127.0.0.1` | ✓ 正确（本地回环） |
| `http://192.168.1.100:8080/` | `你的实际 IP` | ✓ 正确（真实地址） |
| 通过 Nginx 代理（设置头部） | `X-Forwarded-For 中的 IP` | ✓ 正确（代理转发） |
| 通过 Cloudflare | `CF-Connecting-IP` | ✓ 正确（CDN）  |

## 现有代码改进总结

### ClientIpController.java 变化

| 改动 | 说明 |
|-----|------|
| 移除了对 `127.x.x.x` 的过滤 | 现在会返回真实的回环地址，反映直连情况 |
| 增加了更多头部检查 | 支持 X-Client-IP、CF-Connecting-IP 等 |
| 新增 `/api/client-ip/debug` 端点 | 用于诊断 IP 获取问题 |
| 扩展 CORS 配置 | 支持 192.168.* 和 10.* 地址段 |
| 改进了 IPv4 验证逻辑 | 更精确的格式检查 |

### AuditLogController.java 变化

同样的改进应用到审计日志 IP 获取，保持一致性。

## 故障排查

### 问题：通过局域网 IP 访问仍然显示 127.0.0.1

**原因可能：**
1. 防火墙阻止了该端口
2. 应用绑定在 localhost 而非 0.0.0.0
3. 负载均衡器或代理未正确转发

**检查方法：**
```bash
# 检查应用监听的地址
netstat -an | grep 8080

# 应该看到：
# LISTEN  0.0.0.0:8080  （表示监听所有地址）
# 如果是 127.0.0.1:8080，则只能本地访问
```

**修复：**
编辑 `application.properties`，确保没有限制服务器地址：
```properties
server.port=8080
# 不要设置 server.address=127.0.0.1（如果有的话）
```

### 问题：从远程设备访问显示 0.0.0.0

**原因：** IP 提取失败，返回了备用值

**排查：**
```bash
curl -v http://your-server-ip:8080/api/client-ip/debug
# 查看所有头部是否有效
```

## 推荐做法（生产环境）

1. **使用反向代理（Nginx）**
   - 确保正确设置 `X-Real-IP` 和 `X-Forwarded-For`
   - 可以记录真实用户 IP，即使通过 CDN

2. **定期验证 IP 记录**
   ```bash
   # 检查数据库中的 IP 分布
   curl http://your-server:8080/api/audit/logs | jq '.[].ip' | sort | uniq -c
   ```

3. **为不同场景配置特定头部**
   - 本地开发：直接使用服务器 IP
   - 云环境：配置 Cloudflare 或其他 CDN
   - 企业网络：配置企业代理服务器头部

---

**版本**：1.1（已改进 IPv4 检测）  
**最后更新**：2024-12-11
