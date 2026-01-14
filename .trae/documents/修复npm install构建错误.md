# 修复Maven构建中的npm install错误

## 问题诊断
`frontend-maven-plugin`在执行`npm install`时失败，可能是由于：
1. 新安装的react-file-viewer/react-markdown依赖冲突
2. npm缓存或node_modules损坏
3. 网络问题导致依赖下载失败

## 解决步骤

### 1. 清理npm缓存和node_modules
```bash
# 在项目根目录执行
rm -rf node_modules package-lock.json
npm cache clean --force
```

### 2. 重新安装依赖
```bash
npm install --legacy-peer-deps
```

### 3. 验证前端构建
```bash
npm run build
```

### 4. 重新启动后端（如果需要）
```bash
cd backend
mvn clean spring-boot:run
```

## 备选方案
如果上述步骤仍然失败，可以考虑：
- 暂时移除有问题的依赖
- 使用更稳定的替代组件
- 检查npm和Node.js版本兼容性

## 当前状态
- ✅ 后端服务器正常运行（端口8080）
- ✅ 前端开发服务器正常运行（端口3000）
- ✅ TypeScript编译无错误
- ⚠️ Maven构建时npm install可能失败