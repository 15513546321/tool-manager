# 知识库数据持久化和PDF预览崩溃修复方案

## 问题1：数据持久化失败修复

### 根本原因
`spring.sql.init.mode=always`导致每次启动都重新执行初始化脚本，清除所有数据

### 解决方案
1. 修改application.properties，将`spring.sql.init.mode=always`改为`spring.sql.init.mode=embedded`
2. 修改init-data.sql，删除清除数据的语句
3. 确保数据库文件路径正确且持久化

## 问题2：PDF预览崩溃修复

### 根本原因
react-pdf组件可能存在内存溢出、Worker配置或错误处理问题

### 解决方案
1. 添加React Error Boundary保护PDFViewer组件
2. 优化PDFViewer组件，添加内存管理
3. 改进错误处理和降级方案
4. 添加PDF文件大小限制和分页加载
5. 实现更稳定的PDF预览方案（使用iframe作为备选）

## 实施步骤

1. 修复数据库初始化配置，确保数据持久化
2. 优化PDFViewer组件，防止崩溃
3. 添加错误边界和降级方案
4. 测试文档上传和PDF预览功能
5. 验证数据持久化是否正常工作

## 预期效果

- 文档上传后，即使重启服务器也不会丢失
- PDF预览稳定，不会崩溃
- 大文件也能正常预览
- 提供更好的错误处理和用户体验