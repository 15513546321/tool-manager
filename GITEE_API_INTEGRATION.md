# Gitee API 集成更新说明

## 变更概述
已将 Gitee 代码管理功能从 **Mock 数据** 升级至 **真实 Gitee API 调用**。

## 删除的 Mock 数据
✅ 前端 `pages/GiteeManagement.tsx`：
- 删除 `MOCK_BRANCHES` 常量（5 个示例分支）
- 删除 `MOCK_COMMITS` 常量（3 个示例提交）

✅ 后端 `backend/src/main/java/com/toolmanager/controller/GiteeApiController.java`：
- `/api/gitee/test-connection` - 已使用 `GiteeService` 进行真实连接测试
- `/api/gitee/branches` - 已使用 Gitee API 获取真实分支列表
- `/api/gitee/changesets` - 已使用 Gitee API 获取真实提交历史

## 新增实现

### 1. 后端服务 `GiteeService`
文件位置：`backend/src/main/java/com/toolmanager/service/GiteeService.java`

**主要方法：**
- `testConnection(repoUrl, authType, accessToken, privateKey)` - 测试到 Gitee 仓库的连接
- `getBranches(repoUrl, authType, accessToken, searchQuery)` - 获取真实分支列表
- `getChangesets(repoUrl, authType, accessToken, branches)` - 获取真实提交记录

**Gitee API 端点：**
- `GET /api/v5/repos/{owner}/{repo}` - 获取仓库信息
- `GET /api/v5/repos/{owner}/{repo}/branches` - 获取分支列表
- `GET /api/v5/repos/{owner}/{repo}/commits` - 获取提交历史

**支持的 URL 格式：**
```
https://gitee.com/owner/repo
https://gitee.com/owner/repo.git
git@gitee.com:owner/repo.git
```

### 2. 更新的控制器
文件位置：`backend/src/main/java/com/toolmanager/controller/GiteeApiController.java`

三个端点现在均调用 `GiteeService` 获取真实数据：
- POST `/api/gitee/test-connection` - 验证连接
- POST `/api/gitee/branches` - 获取分支
- POST `/api/gitee/changesets` - 获取变更集

## 使用前提

### 1. 获取 Gitee Access Token
1. 登录 [Gitee](https://gitee.com)
2. 进入 **设置** → **私人令牌**
3. 点击 **生成新令牌**
4. 勾选权限：`repos` 和 `user_info`
5. 复制生成的 Token（仅显示一次）

### 2. 在应用中配置
1. 打开 "Gitee 代码管理" 模块
2. 点击 "⚙️ 连接配置"
3. 填写：
   - **仓库地址**：如 `https://gitee.com/yourname/yourrepo`
   - **认证方式**：选择 "HTTPS/Token"
   - **Access Token**：粘贴上述生成的 Token
4. 点击 "保存并测试连接"

## 测试步骤

### ✅ 测试 1：连接验证
1. 在连接配置中填入正确的仓库地址和 Token
2. 点击 "保存并测试连接"
3. **预期结果**：显示 "连接配置已保存，连接测试成功！"

### ✅ 测试 2：获取分支
1. 连接配置成功后，在主界面点击 "🔍 查询"（搜索框）
2. 可选输入分支名称搜索（如 `master`、`develop`）
3. 点击查询按钮
4. **预期结果**：显示 Gitee 仓库中的真实分支列表（包含提交 Hash 和更新时间）

### ✅ 测试 3：获取变更集
1. 在分支列表中勾选一个或多个分支
2. 点击 "获取选中分支变更集"
3. **预期结果**：显示该分支下的真实提交记录（作者、提交信息、日期等）

### ✅ 测试 4：导出数据
1. 在变更集显示后，点击 "⬇️ 导出 Excel"
2. 配置需要导出的字段（如文件路径、分支、提交ID 等）
3. 点击 "导出"
4. **预期结果**：生成包含真实数据的 Excel 文件

## 故障排查

### 问题：连接测试失败 - "Authentication failed: Invalid access token"
**原因**：Access Token 无效或过期
**解决**：
1. 重新获取新的 Gitee Token（上一个 Token 已失效）
2. 确保 Token 具有 `repos` 权限

### 问题：获取分支为空 - "No branches found"
**原因**：仓库地址格式错误或无权限访问
**解决**：
1. 验证仓库地址格式：`https://gitee.com/owner/repo`
2. 确保 Token 对该仓库有读权限
3. 检查仓库是否存在且公开（或 Token 有访问权限）

### 问题：网络超时
**原因**：与 Gitee API 连接缓慢或超时
**解决**：
1. 检查网络连接
2. 等待一段时间后重试
3. 缩小查询范围（如只查询一个分支）

## 技术细节

### 认证方式
目前仅支持 **Token 认证**（HTTPS/Personal Access Token）。SSH 认证框架已预留但暂未实现。

### 数据转换
- Gitee API 返回的 JSON 被转换为统一的内部数据格式
- 分支信息包含：名称、最后提交 Hash、最后更新时间
- 提交信息包含：分支、提交 Hash、作者、日期、提交信息、文件路径（若可用）

### 性能考虑
- 每次查询都直接调用 Gitee API（无缓存）
- 建议限制每次查询的分支数量
- 提交历史默认限制为最近 100 条

## 后续改进方向
- [ ] 支持 SSH 密钥认证
- [ ] 添加数据缓存机制
- [ ] 支持文件级别的变更追踪
- [ ] 集成代码审查数据
- [ ] 性能优化（异步请求、分页处理）
